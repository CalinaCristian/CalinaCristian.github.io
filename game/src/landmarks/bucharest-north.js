// ============================================================================
//  Landmarks — Bucharest north landmarks: Sky Tower, Promenada, Băneasa, Romexpo, Aviatorilor, Gara de Nord, Opera, Hermes, Otopeni airport and its station.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import { buildOTPPier } from '../landmark-otp-pier.js';
import { facadePanels, facadePiers } from '../facade-panels.js';
import * as THREE from '../../vendor/three.module.min.js';
import { bucharestSourceMasses } from './source-data.js';
import { OTP_ROOF_ZONES, OTP_ARRIVALS_PROFILE } from '../landmark-otp-roofs.js';
import { footprintCells } from '../building-parts.js';
import { pts, rect, signedArea, bbox, offset, zAt, xAt, M } from './kit.js';
import { P } from './footprints.js';
import { airliner, C, storeys, nearestFacade, entrance } from './parts.js';

// Sky Tower (Floreasca City Center, 2012) — 137 m, 37 floors, tallest building in Romania (OSM way 219622660:
// height 137, levels 37, colour #3960DA). Lens/ellipse plan, blue glass with white floor-slab lines, the glass
// skin runs past the roof as a crown cut on a slant (≈ 125 -> 137 m), 3-level lobby podium.
// Src: https://en.wikipedia.org/wiki/Sky_Tower_(Bucharest) (137 m, 37 floors) ; OSM way 219622660 ; game/research/bucharest-floreasca.json landmarks[skytower]
export function bSkyTower(b, ctx = {}) {
    const source = ctx.sourceBuildings?.w219622660?.[0];
    const p = source?.ring || P.skytower.map(pts)[0], top = source?.h ?? 137;
    const GL = source?.colour || '#3960da', LN = '#b8c8d4';
    // OSM height137m,37levels and roof:shape=flat are authoritative. The owner's
    // daylight photograph supports vertical glazing variation, not an invented8m crown slope.
    b.prism(p, 0, 5, '#344754', { mat: 'g', top: false });
    b.cap(p, top, source?.roofColour || '#a6a9aa', [], 1, 'g');
    const fh = (top - 5) / 36, sign = signedArea(p) >= 0 ? 1 : -1;
    for (let i = 0; i < p.length; i++) {
        const a = p[i], q = p[(i + 1) % p.length], L = Math.hypot(q[0] - a[0], q[1] - a[1]);
        if (L < 1e-8) continue;
        const n = Math.max(1, Math.round(L / 1.5)), bay = L / n, cuts = new Set([0, L]);
        for (let j = 0; j <= n; j++) for (const d of [-.04, .04]) cuts.add(Math.max(0, Math.min(L, j * bay + d)));
        const xs = [...cuts].sort((u, v) => u - v), hint = [sign * (q[1] - a[1]), 0, -sign * (q[0] - a[0])];
        const face = (lo, hi, y0, y1, colour, material) => {
            if (hi - lo < 1e-9 || y1 - y0 < 1e-9) return;
            const x0 = a[0] + (q[0] - a[0]) * lo / L, z0 = a[1] + (q[1] - a[1]) * lo / L;
            const x1 = a[0] + (q[0] - a[0]) * hi / L, z1 = a[1] + (q[1] - a[1]) * hi / L;
            b.quad([x0,y0,z0],[x1,y0,z1],[x1,y1,z1],[x0,y1,z0],colour,material,hint);
        };
        // Frames and panes partition the same skin. Separate 2.5cm-proud
        // strips caused depth interference at grazing drone angles.
        for (let k = 1; k < xs.length; k++) {
            const lo = xs[k - 1], hi = xs[k], mid = (lo + hi) / 2;
            if (Math.abs(mid - Math.round(mid / bay) * bay) <= .04 + 1e-9) { face(lo,hi,5,top,LN,'m'); continue; }
            const colour = (i + Math.min(n - 1, Math.floor(mid / bay))) % 4 === 1 ? '#a3b5c4' : GL;
            for (let floor = 0; floor < 36; floor++) {
                const y0 = 5 + floor * fh, y1 = floor === 35 ? top : 5 + (floor + 1) * fh;
                const pane0 = floor ? Math.min(y1, y0 + .08) : y0;
                if (floor) face(lo,hi,y0,pane0,LN,'m');
                face(lo,hi,pane0,y1,colour,'g');
            }
        }
    }
    b.colPolygon(p, { holes: source?.holes || [], y1: top });
}

// Promenada Mall (2013, Floreasca) — 3 levels / 18 m (OSM way 240694437), glass + white fins, large planted
// roof terrace with pavilions, red "PROMENADA" lettering on the Calea Floreasca front.
// Src: https://en.wikipedia.org/wiki/Promenada_Mall ; OSM way 240694437
export function bPromenada(b) {
    const [p] = P.promenada.map(pts);
    // Independent exterior photograph: white panel cladding and a dark glazed entrance,
    // rather than three continuous floors of blue windows. Exact entrance bay remains estimated.
    b.prism(p,0,18,'#eef0ed',{topCol:'#c5c7bf'});
    // (round 2, panoramas at 44.47748, 26.10262 heading 48 and 44.47806, 26.10497 heading 257, viewed only): the white panel
    // walls have no ground-floor window row (a row of blue squares ran round the whole building); grey plinth instead
    b.ring(offset(p,0.05),0,1.1,'#a9adab');
    for(let y=3;y<16.5;y+=1.7) b.ring(offset(p,0.04),y,y+0.045,'#c6cccb');
    b.cornice(p,16.1,0.4,0.5,'#f6f7f7');
    // Aerial-measured garden coverage replaces the invented all-green stepped roof.
    b.cap([[-42.6,24.28],[-42.02,8.16],[-31.66,-6.48],[-15.88,-10.02],[5.15,-9.44],[29.17,-7.67],[54.79,-3.76],[63.67,12.22],[61.98,29.87],[46.78,38.1],[25.83,38.55],[3.43,36.43],[-17.49,29.47]],18.025,'#b8ae96');
    b.cap([[5.32,13.41],[4.33,3.6],[10.74,-1.24],[25.91,-2.05],[35.93,4.97],[39.98,14.54],[33.98,24.5],[26.2,30.28],[13.85,30.24],[7.84,21.86]],18.05,'#547f43');
    // Calea Floreasca front (local +z; north end = -x), fidelity pass 2026-11-12. Tenants are the mall's OSM shop nodes
    // (Douglas n4866286221, Hervis n2484107176, Zara n4866294922, C&A n2484089640, H&M n2484107172, Starbucks n4833254421);
    // their arrangement on the front (black tenant band at the north end, Starbucks under it, the glazed entrance hall
    // south of it, then the mall's name with its colour bars) is what the front looks like from the street (viewed only),
    // positions along the wall estimated to a few metres.
    const zf=(zAt([p],-45)?.[1]??50)+0.12;
    b.box(-45,0,zf,20,16.5,0.18,'#27333f',{mat:'g'});
    for(let y=2;y<16;y+=2) b.box(-45,y,zf+0.12,20,0.07,0.07,'#6d7980');
    for(let x=-55;x<=-35;x+=5) b.box(x,0,zf+0.12,0.09,16.5,0.09,'#6d7980');
    b.box(-70.5,9.4,zf,23,2.7,0.14,'#15171a');
    b.box(-72.6,9.75,zf+0.08,3.6,2.0,0.05,'#c8102e');
    for(const [t,x,h,col] of [['DOUGLAS',-78.6,0.5,'#f4f4f4'],['HERVIS',-72.6,0.62,'#ffffff'],['ZARA',-68.1,0.85,'#f4f4f4'],['C&A',-64.4,0.85,'#f4f4f4'],['H&M',-61.2,1.0,'#e50010']])
        b.text(t,x,10.75-h/2,zf+0.1,0,h,col,{d:0.03});
    b.box(-71,0.3,zf,13,3.4,0.12,'#2b3138',{mat:'g'});
    b.text('STARBUCKS COFFEE',-71,4.1,zf-0.06,0,0.5,'#1e3932');
    b.text('PROMENADA',-25,8.4,zf-0.06,0,0.8,'#28568a');
    [['#2f6eb5'],['#f39200'],['#d6336c'],['#7ab800'],['#f2c300'],['#00a0c6'],['#8e44ad'],['#e03c31']].forEach(([col],i)=>b.box(-16.5,3.2+i*1.15,zf-0.06,3.4,0.85,0.12,col));
    // Barbu Văcărescu (east) front = local -z (r3-landmarks-8, 2026-11-13), drawn from the review recorded in
    // research/bucharest-pipera.md (pano 44.478431, 26.104866 h 255, looked at only: "white cladding, dark glazed band,
    // rounded corners, curved roof edge, a large LED screen and flagpoles on a paved forecourt"). The rounded corners are
    // the OSM outline's own. The pano looks square onto this face at about local x = 10; the band's extent and height, the
    // screen's size and place, the roll radius and the flagpoles are estimates (dossier section 9), not measurements.
    const ze=x=>(zAt([p],x)?.[0]??-50), eRy=-Math.atan2(ze(60)-ze(-60),120);
    b.box(0,11.3,ze(0)-0.12,124,4.5,0.2,'#1d2730',{mat:'g',ry:eRy});                        // dark glazed band, upper storey
    for(let x=-61.5;x<=61.5;x+=3) b.box(x,11.3,ze(x)-0.24,0.12,4.5,0.08,'#b9c0c3');          // its mullions
    b.box(0,11.15,ze(0)-0.25,124.4,0.18,0.3,'#eef0ed',{ry:eRy}); b.box(0,15.8,ze(0)-0.25,124.4,0.18,0.3,'#eef0ed',{ry:eRy});
    b.cylX(0,16.3,ze(0)-0.1,1.05,158,'#f3f4f2',14);                                         // rounded roll along the roof edge
    const sx=12,sz=ze(sx);
    b.box(sx,2.6,sz-0.55,15.2,8.6,0.5,'#141619',{ry:eRy});                                   // LED screen: frame
    b.box(sx,2.9,sz-0.83,14.4,8.0,0.06,'#1b4f9c',{ry:eRy,mat:'e'});                          // lit face (a generic advert)
    b.box(sx-3.2,4.1,sz-0.88,6.6,5.6,0.04,'#f4f1e6',{ry:eRy,mat:'e'}); b.box(sx+3.6,8.2,sz-0.88,5.6,1.6,0.04,'#ffcc29',{ry:eRy,mat:'e'});
    for(const sg of [-1,1]) b.box(sx+sg*6.4,0,sz-0.55,0.45,2.6,0.45,'#2a2d31',{ry:eRy});       // its two legs
    [['#002b7f'],['#fcd116'],['#ce1126'],['#003399'],['#ffffff']].forEach(([col],i)=>{       // flagpoles on the forecourt
        const fx=-14+i*7, fz=ze(fx)-9; b.cyl(fx,0,fz,0.08,0.11,10.5,'#e8eaea',8); b.box(fx+1.05,8.3,fz,2.0,1.3,0.03,col,{ry:eRy}); });
    b.colPolygon(p,{y1:18});
}

// Băneasa Shopping City (2008) — 3 levels / 22 m (OSM way 241256765); white-grey box with glass entrance
// pavilions, long skylight spine, "BĂNEASA SHOPPING CITY" signage on the DN1 front.
// Src: https://en.wikipedia.org/wiki/Băneasa_Shopping_City ; OSM way 241256765
export function bBaneasaSC(b) {
    const [p] = P.baneasasc.map(pts);
    b.prism(p, 0, 20, '#dedad3', { topCol: '#bdb9b1' });
    b.windows(p, 0, 20, 6.6, '#56758c', { bay: 6, wf: 0.75, hf: 0.42, start: 0.5, mat: 'g', minL: 14, skip: (e, j, f) => f > 0 && j % 3 !== 1 });
    b.cornice(p, 19.4, 1.2, 0.6, '#ecebe7');
    b.box(0, 20, 0, 26, 1.2, 160, '#cfd6db', { mat: 'g' }); b.box(0, 21.2, 0, 10, 0.8, 160, '#dfe4e7', { mat: 'g' }); // OSM roof envelope: 22 m
    const xf = xAt([p], 0)?.[1] ?? 60;
    b.box(xf + 2, 0, 0, 4, 22, 34, '#3e5f78', { mat: 'g' });
    b.text('BANEASA SHOPPING CITY', xf + 4.1, 15.5, 0, Math.PI / 2, 1.8, '#ffffff');
    b.colPolygon(p, { y1: 22 });
}

// Romexpo — Pavilionul Central (1962, Ascanio Damian et al.) — steel-lattice dome on a circular glazed ring,
// ≈ 93 m span / 34 m high (OSM way 23554160 outline Ø ≈ 125 m incl. the ring gallery). Ribs + lantern.
// Src: https://en.wikipedia.org/wiki/Romexpo ; OSM way 23554160
export function bRomexpo(b) {
    const [p] = P.romexpo.map(pts);
    b.prism(p, 0, 9, '#dcd8ce', { topCol: '#c9c6bd' });
    b.windows(p, 0, 9, 9, '#4f6b80', { bay: 4, wf: 0.85, hf: 0.7, start: 1, mat: 'g', minL: 3 });
    b.cornice(p, 8.6, 0.8, 0.9, '#eceae4');
    const a = 46.5, H = 22.2, R = (a * a + H * H) / (2 * H), th = Math.asin(a / R); // documented 93 m dome span; OSM overall height 34 m
    b.cyl(0, 9, 0, a + 0.5, a + 1, 1.2, '#e7e5df', 32);
    b.geo(new THREE.SphereGeometry(R, 36, 7, 0, Math.PI * 2, 0, th), '#b8c0c4', M(0, 10.2 + H - R, 0), 'g');
    for (let i = 0; i < 24; i++) {
        const ang = i / 24 * Math.PI * 2, pts3 = [];
        for (let k = 0; k <= 5; k++) { const t = th * (1 - k / 5), r = R * Math.sin(t) + 0.25; pts3.push([Math.cos(ang) * r, 10.2 + H - R + R * Math.cos(t) + 0.2, Math.sin(ang) * r]); }
        b.tube(pts3, 0.35, '#e8eaea', { seg: 6, radial: 3 });
    }
    b.cyl(0, 10.2 + H - 0.6, 0, 6, 7, 2.2, '#9aa3a6', 16, { mat: 'g' });
    b.text('ROMEXPO', 0, 3.4, 63.2, 0, 2.6, '#ffffff');
    b.colPolygon(p, { y1: 9 });
}

// Monumentul Eroilor Aerului (1935, Lidia Kotzebue & Iosif Fekete) — ~20 m granite obelisk-pylon
// topped by bronze winged aviators, Piața Aviatorilor (OSM node 559876471).
// Src: https://ro.wikipedia.org/wiki/Monumentul_Eroilor_Aerului ; OSM node 559876471
export function bAviatorilor(b) {
    // Twenty-metre overall monument from independent documentation. Sculpture proportions below
    // are deliberately coarse photo-led estimates, rather than the former rectangular T silhouette.
    const B = C.bronze, ST = '#c7c3b7';
    b.box(0,0,0,9,0.8,9,'#9d998f'); b.box(0,0.8,0,6.7,2.6,6.7,ST);
    b.cyl(0,3.4,0,1.05,2.1,11.4,ST,4,{ry:Math.PI/4});
    for(const a of [0,Math.PI*2/3,Math.PI*4/3]) {
        const x=Math.sin(a)*2.2,z=Math.cos(a)*2.2;
        b.sphere(x,5.8,z,0.48,B,{detail:0});b.strut([x,3.7,z],[x,5.3,z],0.7,1,B);
        b.strut([x,4.4,z],[x+Math.cos(a)*0.8,3.4,z-Math.sin(a)*0.8],0.48,0.6,B);
    }
    // Winged Icarus: separated legs, tapered torso, head and swept feathered wings.
    b.strut([-0.32,14.8,0],[0,17.1,0],0.52,0.5,B);b.strut([0.32,14.8,0],[0,17.1,0],0.52,0.5,B);
    b.cyl(0,16.6,0,0.9,0.44,1.7,B,6);b.sphere(0,18.9,0,0.46,B,{detail:0});
    for(const side of [-1,1]) {
        b.strut([side*0.55,18,0],[side*2.4,18.65,0],0.45,0.5,B);
        for(let i=0;i<7;i++){
            const t=i/6;
            b.strut([side*(0.8+t*1.3),17.9+t*0.45,0.1],[side*(2.2+t*1.5),18.55+t*1.15,0],0.16,0.37,B);
        }
    }
    b.col(0,0,4.5,4.5,0,{y1:3.4});
}

// Gara de Nord (1868-72, rebuilt 1930s-40s and 1990s) — OSM rel 18184857 parts: west head building 5 levels /
// 20 m (way 620595693), central hall 10 m (620595692) with skylight (620563443), north block 18 m over 14 m
// (620563447 / 8543), transverse concourse along the platform heads with a 10 m roof (570330518). Classical
// stucco fronts with tall arched windows, clock + "GARA DE NORD" on the head building, platform canopies
// over peroanele 1-13 (OSM railway=platform, shortened to 160 m).
// Src: https://en.wikipedia.org/wiki/București_Nord_railway_station ; OSM rel 18184857 parts
export function bGara(b) {
    const S = '#e8dcc2', TR = '#ddd0b3', WIN = '#4f4a41';
    b.wall = S;
    const ps = P.gara.map(pts), courts = [[[86.78,-41.87],[94.74,-41.92],[94.68,-50.55],[86.72,-50.5]],[[96.34,42.14],[96.22,30.17],[87.3,30.24],[87.42,42.2]],[[-96.42,41.81],[-91.02,40.07],[-90.95,36.88],[-94.89,36.91],[-97.01,39.64]]];
    // Source relation includes these low connecting wings; 5 m is an explicit one-level estimate.
    { const q=[[-48.93,29.84],[-13.37,29.55],[-5.6,29.49],[-5.65,25.15],[-5.67,22.91],[16.02,22.74],[16.07,26.74],[16.15,35.55],[13.52,35.57],[-5.52,35.73],[-15.72,35.81],[-22.42,35.86],[-28.87,35.92],[-36.92,36.05],[-39.25,36],[-44.57,36.04],[-46.78,36.06],[-48.86,36.08]]; b.prism(q,0,5,S,{topCol:'#96978f'}); b.windows(q,0,5,5,WIN,{bay:4,wf:0.48,hf:0.65,minL:3}); b.colPolygon(q,{y1:5}); }
    { const q=[[-95.67,27.32],[-95.93,20.76],[-94.82,19.67],[-80.25,19.26],[-80.14,22.19],[-33.12,21.42],[-33.13,21.08],[-33.15,19.28],[-33.17,18.41],[-23.33,18.26],[-23.28,21.26],[-5.66,20.97],[-5.67,22.91],[-5.65,25.15],[-5.6,29.49],[-13.37,29.55],[-48.93,29.84],[-48.86,26.68],[-57.72,26.92],[-66.58,27.16],[-94.77,27.92]]; b.prism(q,0,5,S,{topCol:'#96978f'}); b.windows(q,0,5,5,WIN,{bay:4,wf:0.48,hf:0.65,minL:3}); b.colPolygon(q,{y1:5}); }
    { const q=[[-48.45,77.27],[-60.64,76.76],[-67.01,78.16],[-82.44,81.55],[-82.92,79.31],[-84.6,71.43],[-85.09,69.13],[-85.86,65.52],[-87.37,58.44],[-71.57,58.59],[-71.53,60.53],[-66.93,60.43],[-66.91,61.28],[-53.36,61.05],[-53.37,60.33],[-48.63,60.29],[-48.6,62.84],[-48.55,68.18],[-48.53,70.04],[-48.49,74.12]]; b.prism(q,0,5,S,{topCol:'#96978f'}); b.windows(q,0,5,5,WIN,{bay:4,wf:0.48,hf:0.65,minL:3}); b.colPolygon(q,{y1:5}); }
    // central hall + concourse
    b.prism(ps[1], 0, 11, S, { holes: courts.slice(0,2), topCol: '#a9a39a' }); b.windows(ps[1], 0, 10.5, 10.5, WIN, { bay: 5.5, wf: 0.45, hf: 0.7, arch: true, minL: 8 });
    b.cornice(ps[1], 10.6, 0.7, 0.6, TR);
    b.prism(ps[2], 11, 13.5, '#9fb6c3', { mat: 'g' });                                          // skylight ridge
    b.prism(ps[0], 0, 10, S, { topCol: '#8d8a84' }); b.windows(ps[0], 0, 9.5, 9.5, WIN, { bay: 5, wf: 0.6, hf: 0.75, arch: true, minL: 6 });
    b.sourceRoof(ps[0], 10, 2.8, '#7d7a75', 3.5);
    // west head building: 4 storeys + attic, clock and sign
    storeys(b, ps[3], 0, [[6.2, 0.46, 0.7, true], [4.4, 0.42, 0.6, false], [4.2, 0.42, 0.58, false], [3.8, 0.4, 0.55, false]], { holes: [courts[2]], wall: S, win: WIN, trim: TR, bay: 4.2, courses: [0], pilasters: true, pilasterEvery: 2, corniceOut: 0.8, parapet: 1, minL: 5 });
    b.sourceRoof(ps[3], 19.6, 3, '#86827c', 3.5, { holes:[courts[2]], mansard: true });
    // north block (18 m over the 14 m wing)
    // OSM w620638543 is an elevated roof, min_height=10, height=14: keep its portico open.
    b.prism(ps[5],10,14,S,{topCol:'#9e9b91'});
    b.colonnade(36.5,-76.6,75,-76.6,0,10,8,0.8,'#50534f',{capital:TR,seg:10});
    for(let i=0;i<8;i++)b.col(36.5+i*5.5,-76.6,0.85,0.85,0,{y1:10});
    const nb = [[36.9,-42.47],[29.85,-42.41],[29.72,-54.52],[29.64,-62.23],[29.62,-64.39],[33.07,-64.39],[45.34,-64.49],[53.59,-64.55],[61.9,-64.61],[78.91,-64.74],[81.38,-64.81],[81.4,-62.13],[81.59,-42.83],[69.93,-42.75],[62,-42.67],[53.72,-42.61],[45.45,-42.55]]; storeys(b, nb, 10, [[4, 0.42, 0.58, false], [4, 0.42, 0.58, false]], { wall: S, win: WIN, trim: TR, bay: 4.2, corniceOut: 0.7, minL: 5 });
    // Fresh mapped 26 m clock tower and 24 m western turret, omitted by the old massing.
    { const q=[[26.1,-62.2],[26.17,-54.5],[22.34,-54.47],[19.59,-54.44],[18.47,-54.43],[18.43,-58.27],[18.39,-62.14],[22.27,-62.17]]; b.prism(q,0,26,S,{topCol:TR}); b.windows(q,3,22.0,3.5,WIN,{bay:3.5,wf:0.45,hf:0.62,minL:3}); b.cornice(q,25.3,0.7,0.4,TR); b.colPolygon(q,{y1:26}); }
    { const q=[[-106.65,33.23],[-105.69,31.84],[-103.6,28.79],[-102.64,27.4],[-98.23,30.43],[-102.24,36.26]]; b.prism(q,0,24,S,{topCol:TR}); b.windows(q,3,20.0,3.5,WIN,{bay:3.5,wf:0.45,hf:0.62,minL:3}); b.cornice(q,23.3,0.7,0.4,TR); b.colPolygon(q,{y1:24}); }
    b.cyl(22.25,21.2,-62.5,1.55,1.55,0.14,'#f2eee2',20,{rx:Math.PI/2});
    b.strut([22.25,21.2,-62.6],[22.25,22.35,-62.6],0.08,0.08,'#30383b'); b.strut([22.25,21.2,-62.6],[23.15,20.8,-62.6],0.08,0.08,'#30383b');
    // main front on Piața Gării de Nord (north end, -z): arcaded porch, clock, lettering
    b.text('GARA DE NORD',55,11.5,-77.6,Math.PI,1.4,'#515753');
    // platform canopies (thin roofs on posts) over the platforms north of the concourse
    for (const x of [10, 25, 40, 54.5, 68.5, 84, 96.5]) {
        b.box(x, 4.6, 165, 7.5, 0.3, 176, '#8a9196');
        for (let z = 85; z <= 245; z += 16) b.box(x, 0, z, 0.3, 4.6, 0.3, '#5d6468');
    }
    b.colPolygon(ps[0],{y1:10});b.colPolygon(ps[1],{holes:courts.slice(0,2),y1:11});b.colPolygon(ps[3],{holes:[courts[2]],y1:20});
    b.colPolygon(ps[5],{y0:10,y1:14});
}

// Opera Națională București (1953, Octav Doicescu) — classicising, ~22 m with fly tower, columned
// portico towards Bd. Kogălniceanu (+z); OSM way 23556393.
// Src: https://en.wikipedia.org/wiki/Romanian_National_Opera,_Bucharest ; OSM way 23556393
export function bOpera(b) {
    const [p] = P.opera.map(pts), S = '#e2dbca', T = '#eee8dc', GL = '#364348';
    b.wall = S;
    b.prism(p, 0, 21, S, { topCol: '#b3aaa0' });
    b.windows(p,0,20.5,5.2,GL,{bay:5,wf:0.42,hf:0.6,minL:8});
    b.box(0,21,-38,46,13,26,'#d4cdbf'); // fly-tower dimensions remain an explicit estimate
    const zf = zAt([p],0)?.[1] ?? 58;
    // Independent façade photo: three tall round arches, wall piers and a circular attic window.
    // Front detail dimensions are estimates inside the surveyed 49 m-wide front block.
    b.box(0,0,zf+0.3,48,0.8,3.8,C.stoneDk);
    b.box(0,0.8,zf+0.07,31,16.1,0.08,GL);
    b.archWall(44,17,0.6,[-10.5,0,10.5].map(x=>({x,w:8.1,h:15.8})),T,M(0,0.8,zf+0.45));
    for(const x of [-15.5,-5.25,5.25,15.5]) b.box(x,0.8,zf+0.9,0.8,16.6,0.7,T);
    for(const x of [-10.5,0,10.5]) {
        b.box(x,1,zf+0.8,5.2,4.6,0.12,'#242c30');
        b.box(x,5.7,zf+0.9,5.9,0.45,0.65,T);
        b.box(x,0.8,zf+0.95,0.16,14.5,0.16,T);
    }
    b.box(0,17.8,zf+0.5,48,1.6,2,T); b.box(0,20.8,zf-5.3,34,4.3,10.8,S);
    b.cyl(0,22.9,zf+0.19,1.9,1.9,0.11,GL,24,{rx:Math.PI/2});
    b.tube(Array.from({length:25},(_,i)=>{const a=i/24*Math.PI*2;return[Math.cos(a)*2.15,22.9+Math.sin(a)*2.15,zf+0.29];}),0.19,T,{seg:24,radial:4});
    b.pediment(0,25.1,zf-5.3,35,1.1,10.8,T);
    b.colPolygon(p,{y1:21});
}

// Hermes Business Campus (Pipera, 2009) — OSM: Clădirea A 9 levels (way 533147567), B+C with a courtyard
// (458259608) and the smaller building 231123137 (levels unmapped: 7 assumed). Blue-green curtain walls with
// white spandrel lines and aluminium fins, recessed glazed ground floors, rooftop plant boxes, "HERMES" sign.
// Src: https://www.openstreetmap.org/way/533147567 (Clădirea A, 9 levels)
export function bHermes(b, ctx = {}) {
    const fallback=P.hermes.map(pts), ids=['w533147567','w231123137','r6774709'];
    const sources=ids.map(id=>ctx.sourceBuildings?.[id]?.[0]);
    const ps=sources.map((source,i)=>source?.ring||fallback[i]);
    const heights=[36,28,32.4];
    // Fresh OSM gives9levels to bothA andB+C. Untagged metre heights and the
    // smaller block's7-storey rhythm remain explicit estimates. Owner: adventum.eu/asset/hermes-business-campus/.
    for(let i=0;i<3;i++) {
        const source=sources[i],holes=source?.holes||(i===2?[fallback[3]]:[]),top=source?.h??heights[i];
        const levels=source?.levels|| (i===1?7:9),gf=4.5,fh=(top-gf)/Math.max(1,levels-1);
        b.prism(offset(ps[i],-.6),0,gf,'#3f5664',{mat:'g',top:false,holes});
        b.pilasters(ps[i],0,gf,8,.4,.3,'#a8adb0',{});
        const bands=[];
        for(let y=gf+.9;y+fh*.58<=top-.3;y+=fh)bands.push({lo:y,hi:y+fh*.58,colour:'#6d8796',material:'g'});
        const emit=(quad,colour,material,normal)=>b.quad(...quad,colour,material,normal);
        facadePanels(ps[i],gf,top,{wall:'#b3b6b9',bands,strips:(_,length)=>facadePiers(length,9,.9,.025,'#596f7d',3)},emit);
        for(const hole of holes)facadePanels(hole,gf,top,{wall:'#b3b6b9',bands,inward:true},emit);
        b.cap(ps[i],top,source?.roofColour||'#979d9f',holes);
        b.cornice(ps[i],top-.15,.15,.035,'#c9cdcf');
        b.colPolygon(ps[i],{holes,y1:top});
    }
    // Source-address tenant marker, kept at the existing chapter approach.
    entrance(b,nearestFacade(ps[0],2,89),{w:3.6,h:3.4,canopy:2.6,canopyCol:'#e8ecef',canopyText:'HERMES BUSINESS CAMPUS',canopyTextH:.16,canopyTextCol:'#2b4a63',plate:{w:.66,h:.36,y:1.35,bg:'#ffffff',lines:[['LUXOFT',.12,'#2a3a8c'],['A DXC COMPANY',.04,'#5b6b7a']]}});
}

// Aeroportul Băneasa "Aurel Vlaicu" — 1952 terminal (Art-Deco / socialist classicism): three wings
// around a central rotunda with control tower; OSM way 28246549.
// Src: https://en.wikipedia.org/wiki/Aurel_Vlaicu_International_Airport ; OSM way 28246549
export function bBaneasaTerm(b) {
    // Fresh OSM parts: halls A/B/C 8 m, Rotonda 13 m, dome 13–20 m. The former
    // 34.6 m tiered tower at the footprint centroid was unrelated to these mapped volumes.
    const [p] = P.baneasaterm.map(pts), S = '#d9d1bc', GL = '#4c6170';
    b.wall = S; b.prism(p,0,8,S,{topCol:'#a9aaa2'});
    { const q=[[13.04,-28],[15.98,-25.21],[18.24,-21.85],[19.74,-18.08],[20.37,-14.08],[20.14,-10.03],[19.03,-6.15],[17.11,-2.58],[14.46,0.49],[11.21,2.91],[7.51,4.57],[4,5.35],[-0.05,5.4],[-4.02,4.58],[-7.72,2.92],[-10.98,0.5],[-13.64,-2.57],[-15.57,-6.13],[-16.69,-10.03],[-16.95,-14.06],[-16.32,-18.07],[-14.84,-21.84],[-12.58,-25.2],[-9.65,-28],[-6.18,-30.1],[-2.34,-31.4],[1.69,-31.84],[5.72,-31.4],[9.56,-30.1]]; b.prism(q,0,13,S,{topCol:'#a9aaa2'}); b.windows(q,0.4,12.7,3.8,GL,{bay:3,wf:0.62,hf:0.78,start:0.2,mat:'g',minL:1}); b.pilasters(q,0,13,3,0.22,0.15,'#e9e4d4'); b.colPolygon(q,{y1:13}); }
    { const q=[[19.96,-16.16],[23,-18.1],[24.89,-19.25],[26.38,-17.05],[61.97,-38.3],[59.85,-43.08],[62.73,-44.12],[57.19,-55.03],[53.47,-53.55],[51.93,-55.1],[49.13,-53.8],[16.61,-37.19],[21.05,-30.4],[14.1,-27.22],[16.41,-24.79],[18.26,-22],[19.58,-18.59]]; b.prism(q,0,8,S,{topCol:'#a9aaa2'}); b.windows(q,0.4,7.7,3.8,GL,{bay:3,wf:0.62,hf:0.78,start:0.2,mat:'g',minL:1}); b.pilasters(q,0,8,3,0.22,0.15,'#e9e4d4'); b.colPolygon(q,{y1:8}); }
    { const q=[[7.31,8.73],[7.32,10.6],[11.99,10.67],[9.66,50.38],[6.68,50.53],[6.59,55.5],[-6.42,55.33],[-6.4,50.92],[-6.46,44.33],[-7.34,3.16],[-3.58,4.74],[0.42,5.48],[4,5.35],[7.51,4.57],[7.41,5.96]]; b.prism(q,0,8,S,{topCol:'#a9aaa2'}); b.windows(q,0.4,7.7,3.8,GL,{bay:3,wf:0.62,hf:0.78,start:0.2,mat:'g',minL:1}); b.pilasters(q,0,8,3,0.22,0.15,'#e9e4d4'); b.colPolygon(q,{y1:8}); }
    { const q=[[-16.58,-16.78],[-22.85,-20.03],[-24.34,-17.69],[-58.51,-40.03],[-58.21,-40.53],[-62.57,-42.79],[-55.65,-55.14],[-51.21,-53.38],[-50.13,-55.43],[-13.98,-35.34],[-15.16,-32.71],[-7.84,-29.2],[-11,-26.84],[-13.58,-23.85],[-15.45,-20.48]]; b.prism(q,0,8,S,{topCol:'#a9aaa2'}); b.windows(q,0.4,7.7,3.8,GL,{bay:3,wf:0.62,hf:0.78,start:0.2,mat:'g',minL:1}); b.pilasters(q,0,8,3,0.22,0.15,'#e9e4d4'); b.colPolygon(q,{y1:8}); }
    b.dome(1.3,13,-13.5,10.4,7,'#7b8485',24);
    // Small apron control cabin visible in the independent photo. Its precise height/offset
    // are unmapped: explicit estimates, separate from the documented rotunda/dome dimensions.
    b.box(1.3,13,-18.5,2.4,7,2.4,S); b.cyl(1.3,19.7,-18.5,3.5,2.8,0.5,'#dbd8c8',8);
    b.cyl(1.3,20.2,-18.5,3.2,2.8,2.8,GL,8,{mat:'g'});b.cyl(1.3,23,-18.5,3.6,3.6,0.45,S,8);
    for(const x of [-1,3.6])b.cyl(x,23.45,-18.5,0.035,0.035,1.4,'#737d80',5);
    b.colPolygon(p,{y1:8});
}

// Aeroportul Henri Coandă (OTP) — ro.wikipedia "Aeroportul Internațional Henri Coandă": 1970 terminal (now
// Sosiri / arrivals, OSM way 771096081 year_of_construction 1970), Phase I departures + finger (1994-98),
// finger "Vioara" extended 2011 (OSM 771096083, 20 m part 1321861231), new Plecări hall opened 6 Nov 2012
// (OSM 771096082). Control cab: OSM way 794617342 aeroway=tower, 20-25 m (no official height published;
// a 1969 "Tehnica" article describes a 7-level tower on the terminal). Note the world squashes this model 0.35 N-S.
// Src: https://ro.wikipedia.org/wiki/Aeroportul_Internațional_Henri_Coandă ; OSM ways 771096081/82/83, 794617342
export function bOTP(b, ctx = {}) {
    const [dep, arr, pier] = P.otp.map(pts), GL = '#4f7690', WH = '#eef0f1', CON = '#d9d6cf';
    // Independent aerial roof zones, partitioned inside the complete source ring.
    // No overlay faces, missing strips, new source heights or changed colliders.
    const roofZones = (ring, y, profile) => {
        for (const cell of footprintCells(ring, profile.zones.map(z => z.ring))) {
            b.cap(cell.ring, y, cell.covered.length ? profile.zones[cell.covered[0]].colour : profile.base);
        }
    };
    // 2012 departures hall: tall glass box under a thin overhanging roof, landside canopy + signage (+z front)
    b.prism(dep, 0, 19, GL, { mat: 'g', topCol: '#c6cbcf' });
    b.pilasters(dep, 0, 19, 6, 0.3, 0.4, '#d0d6da', {});
    for (const y of [6.5, 12.8]) b.cornice(dep, y, 0.4, 0.3, '#d0d6da');
    b.prism(offset(dep, 4), 19, 21, WH, { top: false, bottom: true });
    b.cap(offset(dep, 4), 21, WH, [dep]);
    roofZones(dep, 21, OTP_ROOF_ZONES.departures);
    b.box(-106, 13.4, 200.5, 190, 0.6, 9, WH);                                              // cantilevered canopy over the upper-level kerb
    b.text('HENRI COANDA', -106, 14.5, 196.6, 0, 2.6, '#ffffff', { mat: 'g' });
    b.text('PLECARI  DEPARTURES', -106, 10.2, 196.6, 0, 1.6, '#ffd84a', { mat: 'g' });
    // (round 2, official panorama on the Plecări kerb at 44.570884, 26.076884, headings 10 / 20 / 100 / 125, viewed only)
    // Silver corrugated barrel-vault canopies on round white columns cover the pavement in front of the door groups, one
    // after another along the kerb; a white cylindrical stair tower closes the south end of the blue curtain wall (its arc
    // is in the mapped outline of w771096082 at about (−12.4, 192.5), r 2.9 m). Vault size, spring height and the five
    // positions along the front are estimates: the door groups are not mapped.
    for (const cx of [-176, -144, -112, -80, -48]) {
        b.geo(new THREE.CylinderGeometry(4.6, 4.6, 17, 12, 1, true, 0, Math.PI), '#b4bcc2', M(cx, 5.3, 201.2, 0, 0.56, 1, 1, 0, Math.PI / 2));
        b.geo(new THREE.CylinderGeometry(4.5, 4.5, 17, 12, 1, true, 0, Math.PI), '#8f979d', M(cx, 5.3, 201.2, 0, 0.56, -1, 1, 0, Math.PI / 2));   // underside
        for (let k = -3; k <= 3; k++) b.geo(new THREE.TorusGeometry(4.62, 0.07, 4, 10, Math.PI), '#d9dee1', M(cx + k * 2.7, 5.3, 201.2, Math.PI / 2, 1, 0.56, 1));   // ribs
        for (const z of [196.7, 205.7]) b.box(cx, 5.0, z, 17, 0.35, 0.3, '#eef0ef');
        for (const sx of [-6.5, 0, 6.5]) b.cyl(cx + sx, 0, 205.6, 0.38, 0.38, 5.0, '#eef0ef', 8);
    }
    b.cyl(-12.4, 0, 192.5, 3.15, 3.15, 20.6, '#ecedea', 16); b.cyl(-12.4, 20.6, 192.5, 3.3, 3.3, 0.4, '#d9dbd8', 16);
    // 1970 "T1" (Sosiri): ten measured repeated roof bays. Nadir imagery
    // establishes their axis/spacing, while1.2m rise is an explicit estimate.
    // Keep the prior total14m and all colliders; clip every bay to the source.
    const ar = OTP_ARRIVALS_PROFILE, [ax, az] = ar.axis, eaves = ar.total - ar.rise;
    const toRoof = ([x,z]) => [x*ax+z*az,-x*az+z*ax];
    const fromRoof = ([q,u],y) => [q*ax-u*az,y,q*az+u*ax];
    const boundaries = [ar.centres[0]-ar.spacing/2,...ar.centres.slice(1).map((q,i)=>(q+ar.centres[i])/2),ar.centres.at(-1)+ar.spacing/2];
    const cuts = boundaries.slice();
    for(let i=0;i<ar.centres.length;i++)for(let s=1;s<ar.sectionsPerBay;s++)cuts.push(s<=ar.sectionsPerBay/2?boundaries[i]+(ar.centres[i]-boundaries[i])*s/(ar.sectionsPerBay/2):ar.centres[i]+(boundaries[i+1]-ar.centres[i])*(s-ar.sectionsPerBay/2)/(ar.sectionsPerBay/2));
    const roofHeight = q => {
        const k=ar.centres.findIndex((_,i)=>q>=boundaries[i]-1e-8&&q<=boundaries[i+1]+1e-8);
        if(k<0)return eaves;
        const t=q<=ar.centres[k]?(q-boundaries[k])/(ar.centres[k]-boundaries[k])/2:.5+(q-ar.centres[k])/(boundaries[k+1]-ar.centres[k])/2;
        return eaves+ar.rise*Math.sin(Math.PI*Math.max(0,Math.min(1,t)));
    };
    const localArr=arr.map(toRoof), spread=bbox([localArr]), sortedCuts=[spread.x0-1,...cuts,spread.x1+1].sort((a,c)=>a-c), bands=sortedCuts.slice(1).map((q,i)=>rect(sortedCuts[i],spread.z0-1,q,spread.z1+1));
    b.prism(arr, 0, eaves, CON, { top:false });
    for(const cell of footprintCells(localArr,bands)){
        const p=cell.ring.map(q=>fromRoof(q,roofHeight(q[0])));
        for(let i=1;i+1<p.length;i++)b.tri(p[0],p[i],p[i+1],ar.colour,'m',[0,1,0]);
    }
    for(let i=0;i<localArr.length;i++){
        const a=localArr[i],c=localArr[(i+1)%localArr.length],ts=[0,1];
        if(Math.abs(c[0]-a[0])>1e-9)for(const q of cuts){const t=(q-a[0])/(c[0]-a[0]);if(t>0&&t<1)ts.push(t);}
        ts.sort((a,c)=>a-c);
        for(let j=1;j<ts.length;j++){
            const p=t=>[a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t],u=p(ts[j-1]),v=p(ts[j]);
            b.quad(fromRoof(u,eaves),fromRoof(v,eaves),fromRoof(v,roofHeight(v[0])),fromRoof(u,roofHeight(u[0])),CON,'m');
        }
    }
    b.prism(offset(arr, 0.05), 0.4, 5, '#3f5b6e', { mat: 'g', top: false });
    b.prism(offset(arr, 0.05), 7, 11, '#5d7e93', { mat: 'g', top: false });
    b.cornice(arr, 11.6, eaves-11.6, 0.9, '#e7e5df'); b.cornice(arr, 5.2, 0.9, 1.6, '#e7e5df');
    b.text('SOSIRI  ARRIVALS', 158.5, 12.2, 195.6, 0, 1.6, '#2f3e4b');
    // Complete airport aggregate r16476195: exact connector outlines around the existing terminal parts.
    // One actual source courtyard (w1215078738); 12 m connector height is explicitly estimated.
    for (const q of bucharestSourceMasses().otp.links) {
        b.prism(q.ring,0,12,'#c9ced2',{holes:q.holes,topCol:'#b8bdc1'});
        b.windows(q.ring,0,12,6,GL,{bay:6,wf:0.8,hf:0.6,mat:'g',minL:10});
        b.colPolygon(q.ring,{holes:q.holes,y1:12});
    }
    const control=bucharestSourceMasses().otp.control;
    // (round 2, same panorama, heading 125) the tower is a stack of ring floors that widen upwards under the cab, not a
    // bare shaft. OSM w794617342 gives only the cab (min_height 20, height 25) and stays as mapped; the five rings below it
    // fill roof → 20 m. In the panorama the tower looks about twice that tall: the tag, not the picture, sets the height.
    b.cyl(63,12,162,2.6,2.6,8,CON,10);
    for (let i = 0; i < 5; i++) { const y = 12.2 + i * 1.56, r = 3.5 + i * 0.6; b.cyl(63, y, 162, r, r - 0.3, 0.4, '#e4e5e1', 12); b.cyl(63, y + 0.4, 162, r - 0.45, r - 0.45, 1.16, '#55748a', 12, { mat: 'g', open: true }); }
    b.prism(control,20,25,'#33505f',{mat:'g',topCol:WH});
    b.colPolygon(control,{y0:20,y1:25});
    b.cyl(63,25,162,0.2,0.2,5,'#d33',6); // aerial mast height remains estimated
    // Source part heights and bridge clearance own their complete mapped footprints.
    // The prior undivided pier extruded those elevated bridges down to the apron.
    const pierOutline = ctx.sourceBuildings?.w771096083?.[0]?.ring || pier;
    buildOTPPier(b, pierOutline, ctx.sourceBuildings, roofZones, OTP_ROOF_ZONES);
    const bb = bbox([pierOutline]), px = bb.x1 + 30;
    airliner(b, px, -150, Math.PI, { tail: '#1d3f8f', stripe: '#1d3f8f' });        // TAROM
    airliner(b, px, -45, Math.PI, { tail: '#c6007e', belly: '#2b0f5c' });           // Wizz Air
    airliner(b, bb.x0 - 26, -120, 0, { tail: '#0b4ea2', stripe: '#0b4ea2' });       // Blue Air
    b.colPolygon(dep, { y1: 21 }); b.colPolygon(arr, { y1: 14 });
}

// Gara „Aeroport Henri Coandă” (CFR airport station, opened 2020-12-13): OSM w813193384 (building=train_station,
// layer=1, min_height=5, building:levels=2, roof:shape=gabled, covered=arcade), a 169 × 18 m strip on the rail viaduct
// in front of the terminals. Official panoramas at 44.568817, 26.073336 heading 66 and 44.56887, 26.07495 headings
// 10 / 60 / 300 (viewed only): a deep concrete box-girder deck on wide wall piers with a crosshead, a green edge band,
// and one long glazed barrel vault on a white lattice over the platforms; an open stair with green rails climbs to the
// west end. The generic rendering was a flat green-topped slab on thin columns. Documented exception: the vault follows
// the panoramas, the mapped `gabled` is the nearest tag for it. Deck depth, vault rise (the two mapped levels: 5 → 13 m),
// pier spacing and the stair's place are estimates; piers are left out where a mapped road passes under the deck.
const OTP_GARA_RING = [[-85.2,-1],[-83.5,16.9],[-24.4,11.4],[45.9,4.6],[61.2,3.3],[85.2,1],[84.9,-1.8],[83.7,-12.5],[83.2,-16.9],[59.3,-14.7],[45.4,-13.4],[-26.5,-6.7]];
export function bOtpGara(b, ctx = {}) {
    const ring = ctx.sourceBuildings?.w813193384?.[0]?.ring || OTP_GARA_RING, CON = '#c9c6bd', GRN = '#2f9460', WH = '#eef0ee';
    const A0 = [-84.35, 7.95], A1 = [84.2, -7.95], L = Math.hypot(A1[0] - A0[0], A1[1] - A0[1]), ux = (A1[0] - A0[0]) / L, uz = (A1[1] - A0[1]) / L, nx = -uz, nz = ux;
    const cx = (A0[0] + A1[0]) / 2, cz = (A0[1] + A1[1]) / 2, ry = Math.atan2(-uz, ux), at = (t, s) => [cx + ux * t + nx * s, cz + uz * t + nz * s];
    const deck0 = 5, deck1 = 7.7, W = 17.4;
    b.prism(offset(ring, -1.6), deck0, deck1 - 0.5, CON, { bottom: true, top: false });                 // box girder
    b.prism(ring, deck1 - 0.5, deck1, CON, { bottom: true, topCol: '#9a9c98' });                        // cantilevered deck slab
    b.ring(offset(ring, 0.05), deck1, deck1 + 0.45, GRN);                                                // green edge band
    // glazed barrel vault on a white lattice
    const R = W / 2 - 0.4, rise = 5.3 / R;
    b.geo(new THREE.CylinderGeometry(R, R, L - 2, 14, 1, true, 0, Math.PI), '#9cc7ba', M(cx, deck1 + 0.45, cz, ry, rise, 1, 1, 0, Math.PI / 2), 'g');
    b.geo(new THREE.CylinderGeometry(R - 0.1, R - 0.1, L - 2, 14, 1, true, 0, Math.PI), '#87aea3', M(cx, deck1 + 0.45, cz, ry, rise, -1, 1, 0, Math.PI / 2), 'g');
    for (let t = -L / 2 + 1; t <= L / 2 - 1 + 1e-6; t += (L - 2) / 28) { const [x, z] = at(t, 0); b.geo(new THREE.TorusGeometry(R + 0.03, 0.09, 4, 10, Math.PI), WH, M(x, deck1 + 0.45, z, ry + Math.PI / 2, 1, rise, 1)); }
    for (const a of [0.42, Math.PI / 2, Math.PI - 0.42]) { const s = Math.cos(a) * (R + 0.04), y = deck1 + 0.45 + Math.sin(a) * (R + 0.04) * rise, p0 = at(-L / 2 + 1, s), p1 = at(L / 2 - 1, s); b.strut([p0[0], y, p0[1]], [p1[0], y, p1[1]], 0.14, 0.14, WH); }
    // wall piers with a crosshead (estimated pitch), none where a mapped road passes underneath
    for (let t = -L / 2 + 12; t <= L / 2 - 12 + 1e-6; t += (L - 24) / 5) {
        const [x, z] = at(t, 0);
        if (ctx.roadAt && [-6, -3, 0, 3, 6].some(s => { const q = at(t, s); return ctx.roadAt(q[0], q[1], -1, 2.5); })) continue;
        b.box(x, 0, z, 2.2, deck0 - 0.9, 8.6, CON, { ry: ry + Math.PI / 2 }); b.box(x, deck0 - 0.9, z, 2.8, 0.9, 13.5, CON, { ry: ry + Math.PI / 2 });
        b.col(x, z, 1.1, 4.3, ry + Math.PI / 2, { y0: 0, y1: deck0 });
    }
    // open stair to the west end, south side
    { const s = W / 2 + 1.6, p0 = at(-L / 2 - 23, s), p1 = at(-L / 2 + 1, s);
      b.strut([p0[0], 0.15, p0[1]], [p1[0], deck1, p1[1]], 2.6, 0.35, CON);
      for (const e of [-1.3, 1.3]) { const q0 = at(-L / 2 - 23, s + e), q1 = at(-L / 2 + 1, s + e); b.strut([q0[0], 1.2, q0[1]], [q1[0], deck1 + 1.05, q1[1]], 0.08, 0.08, GRN); }
      const m = at(-L / 2 - 11, s); b.col(m[0], m[1], 12, 1.4, ry, { y0: 0, y1: deck1 + 1 }); }
}
