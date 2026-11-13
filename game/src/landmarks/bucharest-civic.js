// ============================================================================
//  Landmarks — Bucharest civic landmarks: Parliament, Patriarchal Cathedral, Arcul de Triumf, Casa Presei, Grand Hotel, University, TNB.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { bucharestSourceMasses } from './source-data.js';
import { emitArcGround, emitArcSourceColliders, ARC_SOURCE_FLAGPOLE } from '../landmark-arcul-source.js';
import { pts, rect, ellipse, signedArea, offset, zAt, hash, M } from './kit.js';
import { P } from './footprints.js';
import { C, flag, storeys } from './parts.js';

// Palatul Parlamentului (Anca Petrescu, 1984-97) — 240 m E-W x 270 m N-S, 84 m high (en.wikipedia
// "Palace of the Parliament" infobox; skyscrapercenter.com/building/wd/10216), 12 storeys above ground.
// Footprint OSM rel 2230391 (29 m outer 14325732 + courtyards 167231786/178309073). Massing from the OSM
// building:parts: 58 m tier ring w283976783 (x -63..82 / z -94..106 around the inner courtyard block) and the
// 86 m central block w232360843 (28 x 107 m, x 38..66) set ≈ 20 m behind the tier's EAST face, so the tall block
// stands over the main front. Main front = EAST, on the Bd. Unirii axis (Piața Constituției): portico of paired
// giant columns with the balcony, arcaded wings, steps (OSM w178305826, x 86..102 on the axis), terraced lawns.
// Commons refs "Bucharest - Palace of the Parliament (2024)", "Palace of the Parliament in Bucharest (51878975552)"
// (view from the balcony down Bd. Unirii) and "Bucarest - Palazzo del Parlamento di notte 01" (floodlit at night).
// Src: https://en.wikipedia.org/wiki/Palace_of_the_Parliament ; https://www.skyscrapercenter.com/building/wd/10216 ; OSM rel 2230391
export function bParliament(b) {
    const W = '#f1eadb', TR = '#e8dfcb', WIN = '#56606a', COL = '#f3eee4';
    b.wall = W;
    const [outer, cyN, cyS] = P.parliament.map(pts);
    const Y0 = 1.6;
    // terrace: stepped platform with balustrade around the building
    b.prism(offset(outer, 7), 0, Y0, '#cfc6b3', { topCol: '#d8d0bf' });
    b.ring(offset(outer, 6.6), Y0, Y0 + 1, TR);                                  // terrace balustrade
    // base (ground arcade + 2 arched storeys + mezzanine + attic) to ≈ 29 m; the two OSM courtyards stay open
    const top0 = storeys(b, outer, Y0, [[7.5, 0.5, 0.72, true], [6.2, 0.45, 0.62, true], [5.2, 0.42, 0.55, false], [4.2, 0.34, 0.45, false]],
        { wall: W, win: WIN, bay: 6.9, holes: [cyN, cyS], courses: [0, 2], trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 0.9, corniceOut: 1.2, parapet: 1.3 });
    // corner pavilions of the base rise one storey more, with round-headed attic windows
    const pav = [[-115, -137.5, -86, -106], [86, -137.5, 115, -106], [-115, 106, -84, 137.5], [86, 108, 115, 137.5]];
    for (const [x0, z0, x1, z1] of pav) storeys(b, rect(x0, z0, x1, z1), top0 - 0.8, [[5.5, 0.42, 0.6, true]], { wall: W, win: WIN, bay: 5.8, trim: TR, corniceOut: 0.8, parapet: 1.1, minL: 6 });
    // 58 m tier ring (OSM w283976783) around the lower inner block: arched storeys between paired pilasters
    const tier = pts(P.parliament[3]); // OSM w283976783: retain the actual open return, not a rectangular ring.
    const ts = [[4.6, 0.44, 0.62, true], [4.2, 0.42, 0.55, false], [4.2, 0.42, 0.55, false], [4.6, 0.44, 0.62, true], [4.2, 0.42, 0.55, false], [4.2, 0.42, 0.55, false], [4.4, 0.44, 0.62, true]];
    const top1 = storeys(b, tier, 58 - ts.reduce((sum, f) => sum + f[0], 0) - 2.3, ts, { wall: W, win: WIN, bay: 5.6, courses: [0, 3], trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 0.8, corniceOut: 1, parapet: 1.2 });
    // 86 m central block (OSM w232360843) over the east front: 6 storeys above the tier, arched top storey, flag
    const cen = pts(P.parliament[4]); // OSM w232360843, including the mapped corner returns.
    const cs = [[4.2, 0.44, 0.55, false], [4.4, 0.46, 0.66, true], [4.1, 0.44, 0.55, false], [4.1, 0.44, 0.55, false], [4.4, 0.46, 0.66, true], [4.1, 0.46, 0.66, true]];
    const ct = storeys(b, cen, top1, cs, { wall: W, win: WIN, bay: 6.4, courses: true, trim: TR, pilasters: true, pilasterEvery: 2, pilasterW: 1.1, corniceOut: 1.3, parapet: 1.4, roofCol: '#cfc7b6' });
    for (const [x0, z0, x1, z1] of [[38, -46.7, 44, -40.7], [60, -46.7, 66, -40.7], [38, 54.4, 44, 60.4], [60, 54.4, 66, 60.4]]) b.prism(offset(rect(x0, z0, x1, z1), 0.6), top1 - 1.6, ct - 1, TR, { top: false });  // corner piers
    b.box(52, ct, 7, 8, 2.2, 10, TR);                                              // roof house
    b.cyl(52, ct + 2.2, 7, 0.12, 0.18, 12, '#d8d8d8', 6);
    flag(b, 52, ct + 14, 7, 3.2);
    // EAST portico (main entrance, Bd. Unirii axis): local frame x along the front (= world z), local -z = outward (= world +x)
    b.push(M(86, 0, 0, -Math.PI / 2));
    b.box(0, Y0, -6, 48, 1.2, 12, TR);
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const x = s * (5 + i * 6.2); b.colonnade(x - 1, -10.5, x + 1, -10.5, Y0 + 1.2, 13.5, 2, 0.75, COL, { capital: TR, seg: 8 }); b.box(x, Y0 + 1.2, -10.5, 4.2, 0.8, 2.2, TR); }
    b.box(0, Y0 + 14.7, -6, 50, 2, 12.5, TR);                                      // entablature
    b.box(0, Y0 + 16.7, -6.2, 51, 0.5, 13, '#ece4d2');
    b.fence([[-24, -12], [24, -12]], 1.2, 3.2, TR, { post: 0.45 });                // the balcony balustrade (on the portico roof)
    b.archWall(48, 14, 0.6, [-18, -6, 6, 18].map(x => ({ x, w: 5.5, h: 11 })), '#e6ddca', M(0, Y0 + 1.2, -0.6));   // arcade behind the columns
    for (const x of [-18, -6, 6, 18]) b.box(x, Y0 + 1.2, -0.2, 4.6, 8.5, 0.2, '#4f5760');   // glazed doors in the arcade
    for (const s of [-1, 1]) b.archWall(36, 8.2, 0.8, [-14, -7, 0, 7, 14].map(x => ({ x, w: 4.4, h: 7.2 })), '#efe8d8', M(s * 44, Y0, -0.45));   // arcaded loggias on the front wings
    for (let i = 0; i < 6; i++) b.box(0, i * 0.27, -12.5 - i * 0.6, 30 - i * 0.6, 0.27, 0.6 + (5 - i) * 0.6 * 0 + 0.6, '#ddd5c3');   // steps down to the forecourt (OSM w178305826)
    b.pop();
    // Izvor (west) front: giant colonnade; north (Bd. Națiunile Unite) front: smaller columned entrance
    b.box(-116.5, Y0, -1, 8, 1, 34, TR);
    b.colonnade(-119.5, -14, -119.5, 12, Y0 + 1, 11, 6, 0.65, COL, { capital: TR, seg: 8 });
    b.box(-117, Y0 + 12, -1, 8, 1.6, 34, TR);
    b.push(M(0, 0, -101.5, 0));
    b.box(0, Y0, -4, 30, 1, 8, TR); b.colonnade(-12, -7, 12, -7, Y0 + 1, 11, 6, 0.65, COL, { capital: TR, seg: 8 }); b.box(0, Y0 + 12, -4, 31, 1.6, 8.5, TR);
    b.pop();
    // terraced front gardens on the east (OSM retaining walls + hedges): stepped lawns either side of the axis, flower parterre
    for (const s of [-1, 1]) for (const [x0, h] of [[100, 0.9], [124, 0.55], [140, 0.25]]) b.prism(rect(x0, s > 0 ? 10 : -92, 158, s > 0 ? 92 : -10), 0, h, '#7f9d5e', { topCol: '#86a663' });
    for (const s of [-1, 1]) b.prism(ellipse(130, s * 50, 14, 22, 16), 0.58, 0.7, '#a85a5a', { topCol: s > 0 ? '#c9a23c' : '#9b5ba0' });
    // north forecourt retaining wall with stone pillars and iron railing (OSM w178305226)
    const fl = [[-80.1, -266.3], [-78.7, -179.8], [-81.1, -179.6], [-83.9, -177.1], [-82.8, -161.3], [-78, -156.5], [-34.9, -157.4], [88.3, -159.8], [95.9, -164.8], [96.2, -171.9], [89.8, -182], [88.7, -267.5]];
    b.fence(fl, 1.9, 18, '#d9cfbb', { post: 1, base: 0.9, baseCol: '#d6ccb8', bars: 2.4, postCol: '#e1d8c6' });
    for (let i = 0; i + 1 < fl.length; i++) if (Math.hypot(fl[i + 1][0] - fl[i][0], fl[i + 1][1] - fl[i][1]) > 20) b.colSeg(fl[i][0], fl[i][1], fl[i + 1][0], fl[i + 1][1], 0.6);
    b.colPolygon(outer, { holes: [cyN, cyS], y1: 29 });
    b.colPolygon(tier, { y0: 29, y1: 58 }); b.colPolygon(cen, { y0: 58, y1: 86 }); b.col(93, 0, 7, 25);
}

// Catedrala Mântuirii Neamului (Vanel Exim / A. Ion, 2010-25) — 126.1 m x 67.7 m cross plan. Heights from the 2013
// section drawing (ro.wikipedia "Catedrala Mântuirii Neamului"): walls 41.4 m, Pantocrator drum 71.8-97.8 m, dome to
// 121 m, lantern 127 m, cross 133 m; four secondary towers ≈ 62 m, west bell tower ≈ 75.5 m (+ dome, cross).
// Neo-Brâncovenesc: white stone walls with a band of blind arched niches, tall arched windows; drums are WHITE STONE
// with tall arched windows between paired colonnettes under an arcaded cornice; gilded ribbed hemispherical domes
// with lanterns (Commons "Catedrala Națională a României iunie 2023"), open west porch (pridvor). OSM way 232332568.
// Src: https://ro.wikipedia.org/wiki/Catedrala_Mântuirii_Neamului ; OSM way 232332568
export function bCathedral(b) {
    const S = '#f4f0e7', TR = '#e3dccb', NI = '#d6cdb9', WIN = '#3e434a', GOLD = '#d2a645', GOLDR = '#b88d3a', CL = '#fbf8f1';
    b.wall = S;
    const [outer] = P.cathedral.map(pts), domesLater = [];
    const HW = 48; // OSM primary height52 includes the4m nave roof; do not add a roof above52.
    b.prism(offset(outer, 2.5), 0, 1.4, '#cfc6b4', { topCol: '#d9d1c1' });                      // stylobate
    b.prism(outer, 1.4, HW, S, { topCol: TR });
    b.windows(outer, 1.4, 9, 7.6, '#6d6a62', { bay: 4.4, wf: 0.5, hf: 0.7, start: 1.2, arch: true, minL: 7 });     // ground-floor arcade
    b.windows(outer, 9, 33, 8, WIN, { bay: 4.6, wf: 0.36, hf: 0.5, start: 1.6, arch: true, minL: 9 });              // tall arched windows
    b.windows(outer, 33.2, 39.6, 6.4, NI, { bay: 2.3, wf: 0.6, hf: 0.62, start: 1, arch: true, minL: 9 });          // band of blind niches (ocnițe)
    b.cornice(outer, 9, 0.6, 0.5, GOLDR); b.cornice(outer, 32.6, 0.6, 0.4, TR); b.cornice(outer, HW - 0.6, 1, 0.9, TR);
    // round corner turrets with gilded domes at the ends of the arms
    for (const [x, z] of [[-58.5, -13.5], [-58.5, 13.5], [6.5, -31], [21.5, -31], [6.5, 31], [21.5, 31], [-31, -24], [-31, 24]]) {
        b.cyl(x, 1.4, z, 3.4, 3.6, HW + 4.6, S, 10);
        b.cyl(x, HW + 6, z, 3.9, 3.9, 0.8, TR, 8); domesLater.push([x, HW + 6.8, z, 3.5, 4.2, 10, 0]);
    }
    b.sourceRoof(outer, HW, 4, GOLDR, 3);
    const cross = (x, y, z, h) => { b.box(x, y, z, h * 0.09, h, h * 0.09, GOLD, { mat: 'g' }); b.box(x, y + h * 0.62, z, h * 0.09, h * 0.09, h * 0.52, GOLD, { mat: 'g' }); };
    // gilded ribbed hemispherical dome (slightly raised), ribs, collar; lantern when `lan` > 0
    const domeG = (x, y, z, r, h, seg, lan) => {
        const pr = [[r * 1.04, 0], [r, h * 0.06], [r * 0.97, h * 0.28], [r * 0.87, h * 0.52], [r * 0.68, h * 0.74], [r * 0.4, h * 0.92], [0.001, h]].map(([a, c]) => new THREE.Vector2(a, c));
        b.geo(new THREE.LatheGeometry(pr, seg), GOLD, M(x, y, z), 'g');
        for (let i = 0; i < seg; i += 2) { const a = i / seg * Math.PI * 2, c = Math.cos(a), s2 = Math.sin(a); b.tube(pr.slice(1, 6).map(v => [x + c * (v.x + r * 0.03), y + v.y, z + s2 * (v.x + r * 0.03)]), Math.max(0.12, r * 0.022), GOLDR, { seg: 5, radial: 3, mat: 'g' }); }
        b.cyl(x, y, z, r * 1.08, r * 1.1, Math.max(0.4, r * 0.06), GOLDR, seg, { mat: 'g' });
        if (lan > 0) { const lr = Math.max(0.6, r * 0.16); b.cyl(x, y + h * 0.95, z, lr, lr, lan * 0.7, S, 8); b.dome(x, y + h * 0.95 + lan * 0.7, z, lr * 1.1, lan * 0.3, GOLD, 8, { mat: 'g' }); return y + h * 0.95 + lan; }
        return y + h;
    };
    // drum: white stone polygon, tall arched windows (recessed dark) between paired colonnettes, arcaded cornice
    const drum = (x, z, y0, y1, r, seg, winH, sourceRing = null) => {
        const ring = sourceRing || ellipse(x, z, r, r, seg, Math.PI / seg), side = 2 * r * Math.sin(Math.PI / seg);
        b.prism(ring, y0, y1, S, { top: false });
        b.cornice(ring, y0, 0.9, 0.5, TR);
        b.windows(ring, y0 + 1, y1 - 1.6, y1 - y0 - 2.6, WIN, { bay: side, wf: 0.34, hf: winH, start: (y1 - y0) * 0.12, arch: true, minL: 0.5, off: 0.05 });
        const ch = (y1 - y0) * 0.86, cr = Math.max(0.16, side * 0.045);
        for (let i = 0; i < seg; i++) {
            const a = i / seg * Math.PI * 2 + Math.PI / seg, px = x + Math.cos(a) * (r + cr), pz = z + Math.sin(a) * (r + cr), tx = -Math.sin(a), tz = Math.cos(a);
            for (const d of [-1, 1]) b.cyl(px + tx * d * cr * 1.6, y0 + 0.9, pz + tz * d * cr * 1.6, cr, cr, ch - 0.9, CL, 6);
        }
        b.cornice(ring, y0 + ch, 0.5, 0.35, TR); b.cornice(ring, y1 - 1.2, 1.2, 0.7, TR);
    };
    // Mapped central parts:62.8m mansard base,71.8m lower drum,97.8m drum and127.05m crown.
    const source=bucharestSourceMasses().cathedral, mx=14.61, mz=2.78, base=source.base;
    b.prism(base,HW,58.8,S,{top:false});b.windows(base,HW,58.8,10.8,NI,{bay:2.6,wf:0.6,hf:0.6,start:2,arch:true});
    b.sourceRoof(base,58.8,4,GOLDR,3,{mansard:true});
    const low=source.lowerDrum;
    b.prism(low,62.8,69.8,S,{top:false});b.windows(low,63,69.5,6.5,WIN,{bay:6,wf:0.3,hf:0.6,start:1,arch:true,minL:0.5});
    b.sourceRoof(low,69.8,2,GOLDR,2,{mansard:true});
    drum(mx,mz,71.8,97.8,14.25,16,0.6,source.drum);
    // Keep the ribbed dome/lantern/cross detail while applying the explicit mapped127.05m envelope.
    // Project/engineering references use differing interior-floor and ground datums; recorded in the source ledger.
    const crownScale=(127.05-97.8)/(133.04-97.8);
    b.push(M(0,97.8*(1-crownScale),0,0,1,crownScale,1));
    const ly=domeG(mx,97.8,mz,14.6,23.2,24,7.2);cross(mx,ly,mz,6);b.pop();
    // four secondary towers at the corners of the crossing (≈ 62 m)
    for (const [x, z] of [[mx - 21.5, -21], [mx + 21.5, -21], [mx - 21.5, 21], [mx + 21.5, 21]]) {
        const q = rect(x - 5.2, z - 5.2, x + 5.2, z + 5.2);
        b.prism(q, HW, 52, S, { topCol: GOLDR }); b.windows(q, HW, 52, 4, WIN, { bay: 3.4, wf: 0.36, hf: 0.6, start: 1, arch: true }); b.cornice(q, 51.4, 0.6, 0.6, TR);
        drum(x, z, 52, 65, 4.6, 8, 0.6);
        const y2 = domeG(x, 65, z, 4.9, 7, 12, 1.6);
        cross(x, y2, z, 3.2);
    }
    // Western source body w1282739666 height78; the conflicting height4 dome tag is not an absolute tower height.
    const bx=-46.69,bz=-0.42,bq=source.bell;
    b.prism(bq,HW,64.5,S,{top:false});b.windows(bq,HW,64.5,8.25,WIN,{bay:5,wf:0.4,hf:0.6,start:1,arch:true});
    b.cornice(bq,63.5,1,0.8,TR);drum(bx,bz,64.5,78,11.4,12,0.6);
    const by=domeG(bx,78,bz,11.4,8.5,16,2.6);cross(bx,by,bz,4.5); // dome/cross rise remains a photo-led estimate
    for (const [x, y, z, r, h, sg, lan] of domesLater) { const y2 = domeG(x, y, z, r, h, sg, lan); cross(x, y2 - 0.2, z, 2.4); }
    // west gable: semicircular pediment with a rose window above the porch
    b.geo(new THREE.CylinderGeometry(9, 9, 1.2, 16, 1, false, 0, Math.PI), S, M(-60.6, HW, 0, 0, 1, 1, 1, Math.PI / 2, Math.PI / 2));
    b.cyl(-61.4, 31, 0, 3, 3, 0.4, '#6b7480', 14, { rz: Math.PI / 2 }); b.geo(new THREE.TorusGeometry(3.2, 0.35, 4, 14), TR, M(-61.5, 31, 0, Math.PI / 2));
    // open west porch (pridvor): arcade of stone columns under a gilded roof
    const px = -60.5;
    b.box(px - 6, 0, 0, 13, 1.4, 34, '#cfc6b4');
    b.colonnade(px - 11.5, -15, px - 11.5, 15, 1.4, 11, 7, 0.7, '#f4f0e6', { capital: TR, seg: 8 });
    b.archWall(32, 5, 0.8, [-11.25, -3.75, 3.75, 11.25].map(x => ({ x, w: 5.4, h: 3.6 })), S, M(px - 11.5, 10, 0, Math.PI / 2));
    b.box(px - 6, 15, 0, 13.5, 1, 34.5, TR);
    b.hip(px - 6, 16, 0, 34.5, 13.5, 3.5, GOLDR, { ry: Math.PI / 2 });
    b.colPolygon(outer, { y1: HW }); b.col(px - 6, 0, 6.5, 17);
}

// Arcul de Triumf (Petre Antonescu, 1936 stone version) — 27 m high, single opening (ro.wikipedia "Arcul de
// Triumf din București"); base 25 x 9.3 m (OSM way 217851530). Proportions measured on Commons photos
// "Arco de Triunfo, Bucarest, 2016-05-30, DD 24" / "Arcul de Triumf (24396923048)": opening ≈ 8.8 m wide x 15.7 m,
// recessed frame 14.4 m, inscription band 18.4-20.8 m, cornice 23.2-24.6 m (overhang to ≈ 27 m), attic to 27 m.
// No columns: plain Rușchița-marble piers with corner strips, Jalea/Baraschi medallions, winged-Victory reliefs
// flanking the inscription, royal crown/arms; the four inscriptions in full (arcBand).
// Src: https://ro.wikipedia.org/wiki/Arcul_de_Triumf_din_București ; OSM way 217851530
// The four Arcul de Triumf texts, ro.wikipedia "Arcul de Triumf din București", section "Arhitectura monumentului"
// (accessed 2026-11-13); the same wording the arcul-de-triumf scene quotes at its read-points.
const ARC_TEXT = {
    south: 'DUPĂ SECOLE DE SUFERINȚE CREȘTINEȘTE ÎNDURATE ȘI LUPTE GRELE PENTRU PĂSTRAREA FIINȚEI NAȚIONALE, DUPĂ APĂRAREA PLINĂ DE SACRIFICII A CIVILIZAȚIEI UMANE, SE ÎNDEPLINI DREPTATEA ȘI PENTRU POPORUL ROMÂN, PRIN SABIA REGELUI FERDINAND, CU AJUTORUL ÎNTREGII NAȚIUNI ȘI GÂNDUL REGINEI MARIA',
    north: 'LIBERATOR DE NEAM ȘI ÎNTREGITOR DE HOTARE PRIN VIRTUTEA OSTAȘILOR SĂI VREDNICI URMAȘI AI EROILOR CREȘTINĂTĂȚII FERDINAND I DOMN ȘI REGE AL ROMÂNILOR ȘI-A FĂCUT INTRAREA LA 16 OCTOMBRIE 1922 ÎN CETATEA SA DE SCAUN A BUCUREȘTILOR DUPĂ ÎNCORONAREA LA ALBA-IULIA',
    east: 'GLORIE CELOR CE PRIN LUMINA MINTEI ȘI PUTEREA SUFLETULUI AU PREGĂTIT UNITATEA NAȚIONALĂ',
    west: 'GLORIE CELOR CE PRIN VITEJIA ȘI PRIN JERTFA LOR DE SÂNGE AU ÎNFĂPTUIT UNITATEA NAȚIONALĂ',
};
/** a text in `lines` lines of equal-ish length (word breaks), centred on (x, z), top at yTop, letters sized to fit `width` */
function arcBand(b, text, lines, x, z, ry, yTop, width, col) {
    const words = text.split(' '), target = text.length / lines, out = []; let cur = '';
    for (const w of words) { if (cur && out.length < lines - 1 && cur.length + 1 + w.length / 2 > target) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    out.push(cur);
    const h = Math.min(0.36, width / (Math.max(...out.map((l) => l.length)) * 6 / 7)), pitch = h * 1.35;
    out.forEach((l, i) => b.text(l, x, yTop - (i + 1) * pitch, z, ry, h, col));
}
export function bArcul(b) {
    const W = 25, D = 9.6, S = '#ebe3d2', S2 = '#e0d5bf', TR = '#f2ecdf', RL = '#cdbfa3', TX = '#857660';   // pale Rușchița marble
    emitArcGround(b); // four literal pier bases and the .01/.1m public passage, never a solid plinth across it
    b.archWall(W, 17.1, D, [{ x: 0, w: 8.8, h: 15.7 }], S, M(0, 1.3, 0));                     // piers + vault
    b.archWall(D + 0.1, 4.4, 2.2, [{ x: 0, w: 1.8, h: 3.2 }], S, M(-W / 2 + 1.1, 1.3, 0, Math.PI / 2));   // small side doors
    b.archWall(D + 0.1, 4.4, 2.2, [{ x: 0, w: 1.8, h: 3.2 }], S, M(W / 2 - 1.1, 1.3, 0, Math.PI / 2));
    for (const s of [-1, 1]) {
        const z = s * (D / 2), zo = s * 0.12;
        b.archWall(14.4, 17.1 - 1.3, 0.25, [{ x: 0, w: 9.6, h: 16.1 }], S2, M(0, 1.3, z - zo));       // recessed arch frame (shadow rim)
        for (const x of [-W / 2 + 0.5, -7.6, 7.6, W / 2 - 0.5]) b.box(x, 1.3, z + zo, 1, 17.1, 0.24, TR); // vertical strips
        for (const x of [-9.9, 9.9]) {
            b.cyl(x, 12.4, z + s * 0.25, 1.25, 1.25, 0.35, '#efe7d7', 16, { rx: Math.PI / 2 });     // medallion (Bărbăția / Credința)
            b.cyl(x, 12.4, z + s * 0.45, 0.9, 0.9, 0.2, RL, 12, { rx: Math.PI / 2 });
            b.box(x, 14.4, z + s * 0.2, 1.1, 1, 0.3, RL);                                            // crown above
            b.box(x, 4.4, z + s * 0.12, 2.6, 1.1, 0.2, RL);                                          // lower panel
        }
        b.box(0, 15.8, z + s * 0.18, 1.4, 1.6, 0.4, TR);                                            // keystone
        b.geo(new THREE.TorusGeometry(4.75, 0.28, 4, 18, Math.PI), TR, M(0, 1.3 + 15.7 - 4.4, z + s * 0.12));        // archivolt moulding
        for (const x of [-4.75, 4.75]) b.box(x, 1.3, z + s * 0.12, 0.56, 11.9, 0.3, TR);                          // jamb mouldings
        // entablature: inscription band with winged Victories either side
        b.box(0, 18.4, 0, W, 2.4, D, S);
        b.box(0, 18.45, z + s * 0.1, 15.2, 2.3, 0.2, '#e3d6bd');
        for (const x of [-10.2, 10.2]) { b.box(x, 18.5, z + s * 0.15, 3.8, 2.2, 0.3, RL); b.box(x - 0.6, 18.9, z + s * 0.35, 1.2, 1.5, 0.3, '#b5a283'); b.box(x + 0.7, 19.6, z + s * 0.35, 1.8, 0.5, 0.3, '#b5a283', { rz: -0.4 }); }
    }
    // inscriptions: the full texts as ro.wikipedia.org/wiki/Arcul_de_Triumf_din_București gives them (section „Arhitectura
    // monumentului”, accessed 2026-11-13; no footnote there), carved as long lines of small capitals: five lines across each
    // long face's band between the Victories, three on each short face. Wording from the article only, never from
    // panoramas; the carved line breaks are not in the source (lines are balanced by length: an estimate). The model's
    // local +z face is north, -z south; local +x is west after the placement rotation, -x east.
    const n = D / 2 + 0.18;
    arcBand(b, ARC_TEXT.north, 5, 0, n, 0, 20.62, 14.4, TX);
    arcBand(b, ARC_TEXT.south, 5, 0, -n, Math.PI, 20.62, 14.4, TX);
    arcBand(b, ARC_TEXT.west, 3, W / 2 + 0.1, 0, Math.PI / 2, 20.45, 8.4, TX);
    arcBand(b, ARC_TEXT.east, 3, -W / 2 - 0.1, 0, -Math.PI / 2, 20.45, 8.4, TX);
    // royal arms in the passage + coffered vault ribs
    for (const s of [-1, 1]) b.box(s * 4.3, 8, 0, 0.3, 2.6, 2.2, RL);
    // cornice, attic with acroteria, flag
    b.box(0, 20.8, 0, W + 0.6, 0.6, D + 0.6, TR);
    b.box(0, 22.6, 0, W + 1.2, 0.6, D + 1.2, TR);
    b.box(0, 23.2, 0, W + 2.2, 1.4, D + 2.2, '#e9dfcb');
    b.box(0, 21.4, 0, W - 0.2, 1.2, D - 0.2, S2);
    b.box(0, 24.6, 0, W - 1.2, 2.4, D - 1.2, S);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.box(-9.4 + i * 3.76, 27, s * (D / 2 - 0.8), 0.9, 0.8, 0.9, TR);
    const fp = ARC_SOURCE_FLAGPOLE;
    b.cyl(fp.point[0], fp.minimumM, fp.point[1], .05, .05, fp.heightM - fp.minimumM, '#dddddd', 6);
    flag(b, fp.point[0], fp.heightM - .05, fp.point[1], 1.8);
    // The scene/district owns mapped bollards; do not duplicate them with an
    // invented ellipse inside the actual public pedestrian walks.
    emitArcSourceColliders(b); // exact27 source parts retain their tagged vertical intervals
}

// Casa Presei Libere (ex-Casa Scînteii, Horia Maicu, 1952-57) — 91.6 m + 12.4 m antenna = 104 m (ro.wikipedia
// "Casa Presei Libere"). Massing from the OSM building:parts of rel 15922160: wings A1-A4 4 levels / 24 m,
// B/C wings 5-6 levels / 24 m with corner turrets 25-30 m, central body D 13 levels / 50 m (x 60..92, z ±45),
// tower 67..85 x ±17 from 50 to 70 m, then stepped crown to 91.6 m. Front (+x) faces Piața Presei Libere
// (fountain OSM 1173487799). Stalinist "wedding cake": ochre stone, vertical pilaster strips, pinnacles.
// Src: https://ro.wikipedia.org/wiki/Casa_Presei_Libere ; OSM rel 15922160 (+ building:parts)
export function bCasaPresei(b) {
    const S = '#e3d7bd', TR = '#ece2cb', W = '#5b5448', R = '#cdbf9f';
    b.wall = S;
    const [outer, c1, c2, c3] = P.casapresei.map(pts);
    const st = (n, h = 4.2, wf = 0.38) => Array.from({ length: n }, () => [h, wf, 0.62, false]);
    storeys(b, outer, 0, [[5.2, 0.5, 0.62, true], ...st(3, 4.3, 0.52), [4.3, 0.52, 0.5, false]], { wall: S, win: W, trim: TR, bay: 7, holes: [c1, c2, c3], pilasters: false, pilasterW: 0.7, corniceOut: 0.8, parapet: 1.2, minL: 12, roofCol: '#bfb197' });
    // corner pavilions of the front wings with little Stalinist turrets (OSM parts 25 m + 30 m)
    for (const [x, z] of [[24, -130], [121, -130], [24, 130], [121, 130], [-118, -62], [-118, 62]]) {
        b.prism(rect(x - 9, z - 9, x + 9, z + 9), 23, 26.5, TR, { topCol: R });
        b.prism(rect(x - 5, z - 5, x + 5, z + 5), 26.5, 31, S, { topCol: R }); b.windows(rect(x - 5, z - 5, x + 5, z + 5), 26.5, 31, 4.5, W, { bay: 2.5, wf: 0.4, hf: 0.6, arch: true, minL: 3 });
        b.hip(x, 31, z, 10, 10, 4, R); b.cyl(x, 35, z, 0.15, 0.5, 4, TR, 6);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cone(x + sx * 8, 26.5, z + sz * 8, 0.8, 3.5, TR, 6);
    }
    // central body D (13 levels, 50 m) with a tall arched entrance risalit on the front
    const D = rect(56, -45, 92, 45);
    storeys(b, D, 0, [[6, 0.5, 0.65, true], ...st(10, 3.8), [4.6, 0.42, 0.6, true]], { wall: S, win: W, trim: TR, bay: 4, pilasters: true, pilasterEvery: 2, pilasterW: 0.8, corniceOut: 1, parapet: 1.4, roofCol: R });
    b.box(93.2, 0, 0, 2.4, 44, 22, TR); b.windows(rect(92, -11, 94.4, 11), 6, 43, 3.8, W, { bay: 2.8, wf: 0.36, hf: 0.62, edges: [1], minL: 3 });
    b.archWall(16, 12, 1.2, [{ x: 0, w: 8, h: 10.5 }], TR, M(94.8, 0, 0, Math.PI / 2));
    // corner risalits of D rise ≈ 2 storeys higher, each with a small lantern (Commons "House of Free Press.jpg")
    for (const zc of [-40, 40]) {
        const r = rect(56, zc - 5.5, 92.5, zc + 5.5);
        b.prism(r, 49, 57, S, { topCol: R }); b.windows(r, 49, 57, 4, W, { bay: 3.6, wf: 0.4, hf: 0.55, minL: 4 }); b.cornice(r, 56.5, 0.7, 0.6, TR);
        b.prism(rect(84, zc - 3.5, 91, zc + 3.5), 57.2, 62, TR, { topCol: R }); b.hip(87.5, 62, zc, 7, 7, 2.5, R); b.cyl(87.5, 64.5, zc, 0.12, 0.12, 3, '#bbb', 4);
    }
    // tower: 18 m block on D (OSM part 1177639748, 50 -> 70 m) with corner pinnacles, a lantern stage and the
    // tapering spire (≈ 78 -> 92 m) carrying the TV antenna to 104 m
    const t1 = rect(67, -17, 85, 17);
    b.prism(t1, 51.5, 70, S, { topCol: R }); b.windows(t1, 51.5, 69, 3.6, W, { bay: 2.8, wf: 0.4, hf: 0.6, minL: 4 });
    b.pilasters(t1, 51.5, 70, 5.6, 0.6, 0.3, TR, {}); b.cornice(t1, 69.4, 0.8, 0.6, TR);
    for (const [x, z] of [[67, -17], [85, -17], [85, 17], [67, 17]]) { b.box(x, 70, z, 1.6, 3, 1.6, TR); b.cone(x, 73, z, 0.9, 3.4, TR, 6); }
    const t2 = rect(72.5, -4.5, 79.5, 4.5);
    b.prism(t2, 70, 79, S, { topCol: R }); b.windows(t2, 70, 78, 4, W, { bay: 2.3, wf: 0.45, hf: 0.65, arch: true, minL: 3 }); b.cornice(t2, 78.5, 0.6, 0.5, TR);
    for (const [x, z] of [[72.5, -4.5], [79.5, -4.5], [79.5, 4.5], [72.5, 4.5]]) b.cone(x, 79, z, 0.6, 2.6, TR, 6);
    b.cyl(76, 79, 0, 2.6, 3.4, 4, TR, 8);
    b.cyl(76, 83, 0, 0.7, 2.6, 9.5, '#cdbd9a', 8);                                         // spire
    b.cyl(76, 92.5, 0, 0.25, 0.55, 11.5, '#9aa0a5', 6);                                    // TV antenna to 104 m
    for (const y of [94, 97, 100]) b.box(76, y, 0, 2.2, 0.15, 0.15, '#9aa0a5');
    // fountain + forecourt in front
    b.prism(ellipse(116, 1, 7.5, 12.5, 16), 0, 0.6, '#cfc6b3'); b.prism(ellipse(116, 1, 6.8, 11.8, 16), 0, 0.45, C.water, { mat: 'w' });
    b.colPolygon(outer, { holes: [c1, c2, c3], y1: 24 });
}

// Grand Hotel Bucharest (ex-InterContinental, 1971, D. Hariton / G. Nădrag / I. Moscu / R. Ionescu) — 24 levels,
// 87-90 m (OSM way 1111645542 height 87, tower part 23781503 height 90). Tower plan from that part (simplified):
// concave curved faces lined with a continuous balcony per floor (white parapets, room fins every ≈ 4 m),
// 4-level podium (OSM parts 1019802601/602, 15 m commercial part 937332760) with a glazed ground floor.
const GH_TOWER = [-22.2, 6.0, -21.9, -3.7, -18.9, -3.0, -18.2, -4.7, -21.1, -7.3, -13.6, -12.9, -9.1, -8.7, -0.9, -5.8, 6.5, -6.6, 9.8, -8.0, 14.9, -12.3, 21.9, -5.9, 19.1, -2.9, 19.7, -1.6, 22.8, -2.5, 22.7, 7.3, 19.7, 8.5, 14.6, 12.5, 10.8, 18.8, 9.8, 25.4, 11.0, 31.1, 2.7, 31.3, 2.1, 28.5, -0.2, 28.5, -1.6, 31.3, -11.4, 30.7, -9.9, 22.1, -11.6, 15.6, -15.9, 9.8];
// Src: https://en.wikipedia.org/wiki/InterContinental_Bucharest ; OSM ways 1111645542 / 23781503
export function bGrandHotel(b) {
    const WH = '#f1f0eb', GL = '#33414d', CON = '#d9d6ce';
    b.wall = WH;
    const [p] = P.grandhotel.map(pts), t = pts(GH_TOWER);
    // podium: glazed shop/lobby floor + 3 levels of ribbon windows
    b.prism(p, 0, 16, CON, { topCol: '#bdb8ae' });
    b.prism(offset(p, 0.1), 0.3, 5.2, GL, { mat: 'g', top: false });
    b.windows(p, 5.2, 15.5, 3.4, '#46525c', { bay: 3.2, wf: 0.8, hf: 0.55, minL: 3 });
    b.cornice(p, 15.4, 0.8, 0.5, WH);
    b.prism(rect(-11, -31, 13, -20), 0, 10, CON, { topCol: '#9fb5c0' });                    // north entrance pavilion (roof 5-10 m)
    // tower: dark glazing set back behind a balcony slab + parapet per floor, room fins
    const TOP = 84, fh = 3.05;
    b.prism(t, 16, TOP, GL, { mat: 'g', topCol: CON });
    const bo = offset(t, 1.5);
    for (let y = 16 + fh; y < TOP - 1; y += fh) {
        b.ring(bo, y - 0.2, y + 0.95, WH);                                                     // balcony parapet
        b.lip(t, bo, y - 0.2, '#cfccc4', -1); b.lip(t, bo, y + 0.95, WH, 1);
    }
    b.pilasters(t, 16, TOP, 4.1, 0.28, 1.5, WH, { inner: true });                              // fins between rooms
    b.pilasters(t, 16, TOP, 30, 0.9, 1.6, WH, { ends: true });                                 // corner piers
    // crown: plant floor + sign
    const cr = offset(t, -2);
    b.prism(cr, TOP, TOP + 4.5, WH, { topCol: CON }); b.windows(cr, TOP, TOP + 4.5, 4.5, GL, { bay: 2.5, wf: 0.7, hf: 0.5, minL: 3 });
    b.prism(rect(-8, 2, 8, 16), TOP + 4.5, TOP + 6.5, CON);
    b.text('GRAND HOTEL', 0, TOP + 1.2, 29.6, 0, 2.2, '#c9a64a');
    b.text('GRAND HOTEL', 0, TOP + 1.2, -4.2, Math.PI, 2.2, '#c9a64a');
    b.colPolygon(p, { y1: 16 });
}

// Palatul Universității (Alexandru Orăscu, 1857-69, enlarged 1912-26) — 200 x 64 m block (OSM way 129316956:
// 4 levels, colour #CABC91, roof "quadruple_saltbox" = grey zinc mansards). Commons "Bucharest (8273345546).jpg":
// 4 storeys of tall windows, zinc mansards with dormers, higher pavilion roofs with arched gables, rounded
// corner with a small dome on Piața Universității (-x/-z). Statues square in front of the south (-z) front,
// positions from OSM nodes 2466907140-43: Mihai Viteazul (equestrian, Carrier-Belleuse 1874), Heliade Rădulescu,
// Gheorghe Lazăr, Spiru Haret.
// Src: https://en.wikipedia.org/wiki/University_of_Bucharest ; OSM way 129316956, statue nodes 2466907140-43
export function bUniv(b) {
    const S = '#d9cba3', TR = '#e6dbbd', WIN = '#4f4b43', Z = '#8e9aa2', ZD = '#76838c';
    b.wall = S;
    const ps = P.univ.map(pts), outer = ps[3];
    storeys(b, outer, 0, [[5.6, 0.44, 0.68, true], [4.8, 0.4, 0.62, false], [4.5, 0.4, 0.6, false], [3.8, 0.36, 0.5, false]],
        { wall: S, win: WIN, trim: TR, bay: 5, courses: [0], pilasters: true, pilasterEvery: 3, pilasterW: 0.7, corniceOut: 1, minL: 8, roofCol: ZD });
    // zinc mansard + dormers
    b.sourceRoof(outer, 19.8, 5.2, Z, 4.6, { mansard: true });
    const din = offset(outer, -1.3);
    b.windows(din, 19.8, 24, 4.2, '#e8e1cc', { bay: 6.5, wf: 0.25, hf: 0.55, start: 0.6, minL: 12, off: 0.5 });
    // pavilions: higher mansard domes with arched gables (ends, centre of the front, rear corners)
    const pav = [[-100, -40, -78, -10], [78, -40, 100, -2], [-14, -40, 14, -12], [-100, 10, -78, 40], [78, 10, 100, 40]];
    for (const [x0, z0_, x1, z1_] of pav) {
        const zr = zAt([outer], (x0 + x1) / 2), z0 = Math.max(z0_, zr[0]), z1 = Math.min(z1_, zr[1]);
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
        b.hip(cx, 19.8, cz, w - 1, d - 1, 9, Z, { ridge: Math.max(0, (w - d) / 2 - 2) });
        b.archWall(Math.min(9, w - 6), 4.2, 0.6, [{ x: 0, w: 2.6, h: 2.8 }], TR, M(cx, 20.4, z0 + 0.2));
        b.dome(cx, 24.4, z0 + 0.2, 4.4, 1.6, TR, 8);
    }
    // rounded corner on Piața Universității with a small dome + lantern
    b.cyl(-97, 0, -29, 5.5, 5.5, 19.8, S, 12); b.cyl(-97, 19.8, -29, 5.9, 5.9, 1, TR, 12);
    b.dome(-97, 20.8, -29, 5.2, 6, Z, 12); b.cyl(-97, 26.6, -29, 0.9, 1.1, 2.2, TR, 8); b.cone(-97, 28.8, -29, 1, 2, ZD, 8);
    // central portico on the south front: 6 columns over the ground floor, balcony, arched gable
    const zf = zAt([outer], 0)[0];
    b.box(0, 0, zf - 3, 30, 1, 6, '#c9bfa8');
    b.colonnade(-12, zf - 4.5, 12, zf - 4.5, 1, 9.4, 6, 0.75, '#efe8d6', { capital: TR, seg: 8 });
    b.box(0, 10.4, zf - 3, 30, 1.2, 6.5, TR);
    b.fence([[-14.5, zf - 6], [14.5, zf - 6]], 1.1, 2.4, TR, { post: 0.4 });
    b.colonnade(-10, zf - 1, 10, zf - 1, 11.6, 8, 6, 0.55, '#efe8d6', { seg: 6 });
    b.text('UNIVERSITATEA DIN BUCURESTI', 0, 20.15, zf - 1.15, Math.PI, 0.75, '#6f6450');
    // the statues square: plinths + bronze figures (OSM nodes, model frame)
    const BR = '#4f4a3c', PL = '#bdb5a6';
    b.box(-4.2, 0, -61.5, 5.5, 1, 8.5, PL); b.box(-4.2, 1, -61.5, 3.6, 4.2, 6.2, '#c9c1b2');
    b.box(-4.2, 5.2, -61.5, 1.3, 2.2, 4.4, BR); b.box(-4.2, 6.6, -63.6, 0.9, 1.4, 1, BR, { rx: -0.5 });   // horse
    for (const [dz] of [[-1.4], [1.4]]) for (const dx of [-0.4, 0.4]) b.box(-4.2 + dx, 5.2 - 2, -61.5 + dz, 0.25, 2, 0.25, BR);
    b.box(-4.2, 7.4, -61.2, 0.8, 1.8, 0.8, BR); b.box(-4.2, 9.2, -61.2, 0.5, 0.5, 0.5, BR); b.box(-4.2, 8.4, -62.4, 0.15, 0.15, 2.8, BR, { rx: -0.6 }); // rider + raised axe
    for (const [x, z] of [[-38.8, -65], [29.9, -58.3], [61.7, -56.6]]) {
        b.box(x, 0, z, 3.4, 1, 3.4, PL); b.box(x, 1, z, 2.2, 3.4, 2.2, '#c9c1b2');
        b.cyl(x, 4.4, z, 0.45, 0.6, 2.2, BR, 6); b.sphere(x, 6.85, z, 0.32, BR, { detail: 0 });
    }
    b.colPolygon(outer, { y1: 19.8 });
    b.col(-4.2, -61.5, 2.8, 4.3); for (const [x, z] of [[-38.8, -65], [29.9, -58.3], [61.7, -56.6]]) b.col(x, z, 1.7, 1.7);
}

// Teatrul Național București (Horia Maicu / Romeo Belea / Nicolae Cucu 1967-73; 2010-15 refurbishment that
// removed Cezar Lăzărescu's 1983 facades and restored Belea's reinforced-concrete "pălărie" (terracotta-red
// flared roof edge, white stage-tower cubes above — Commons "Bucharest - New National Theater (19237949514)") — ro.wikipedia
// "Teatrul Național Ion Luca Caragiale din București"). Footprint + 24 m from OSM way 41542957; glazed body
// under the flared white "hat" roof, fly tower of the Sala Mare above; Ioan Bolborea's bronze group
// "Căruța cu paiațe" (7 m, 2010) and the Caragiale statue (3.5 m) in front from OSM ways 1435346473/74.
// Src: https://ro.wikipedia.org/wiki/Teatrul_Național_„Ion_Luca_Caragiale”_din_București ; OSM way 41542957
export function bTNB(b) {
    const [p] = P.tnb.map(pts), WH = '#f2f1ec', HAT = '#9c3b2c', GL = '#2f3d48', BR = '#5a4a36';
    // glazed body with mullions
    b.prism(p, 0, 16.5, GL, { mat: 'g', topCol: '#bfbab0' });
    b.pilasters(p, 0, 16.5, 3, 0.18, 0.25, '#c9ccc9', {});
    for (const y of [5.5, 11]) b.cornice(p, y, 0.35, 0.3, '#c9ccc9');
    b.prism(offset(p, 0.4), 0, 0.6, '#bdb6a8');
    // the "hat": sloped white soffit flaring out, fascia, flat top
    const a = offset(p, 0.3), c = offset(p, 5.5);
    const sgn = signedArea(p) > 0 ? 1 : -1;
    for (let i = 0; i < p.length; i++) {
        const j = (i + 1) % p.length;
        b.quad([a[i][0], 16.5, a[i][1]], [a[j][0], 16.5, a[j][1]], [c[j][0], 20.5, c[j][1]], [c[i][0], 20.5, c[i][1]], HAT, 'm', [sgn * (a[j][1] - a[i][1]), -1, -sgn * (a[j][0] - a[i][0])]);
    }
    b.prism(c, 20.5, 23.8, HAT, { topCol: '#8a3427' });
    b.cornice(c, 23.8, 0.5, 0.15, '#b04a38');
    // fly tower + secondary stage volume
    b.prism(rect(22, -20, 66, 30), 23.8, 34, '#e8e6e0', { topCol: '#cfccc4' });
    b.windows(rect(22, -20, 66, 30), 24, 33, 9, '#a8b0b5', { bay: 2.2, wf: 0.18, hf: 0.9, start: 0.3, minL: 10 });
    b.prism(rect(-62, -30, -20, 20), 23.8, 29, '#e8e6e0', { topCol: '#cfccc4' });
    // sign on the front (+z)
    b.text('TEATRUL NATIONAL', 45, 21.2, 60.7, 0, 1.7, '#f2efe6');
    // forecourt: "Căruța cu paiațe" bronze group (cart, figures) + Caragiale statue
    b.box(39.4, 0, 98.6, 13, 0.6, 14, '#c8c1b4');
    b.box(39.4, 0.6, 98.6, 5, 2.4, 9, BR); for (const s of [-1, 1]) b.cyl(39.4 + s * 2.8, 1.6, 98.6 + 2.5, 1.6, 1.6, 0.4, BR, 10, { rz: Math.PI / 2 });
    for (let i = 0; i < 6; i++) { const x = 37 + (i % 3) * 2.3, z = 95 + Math.floor(i / 3) * 6; b.cyl(x, 3, z, 0.35, 0.5, 2.6 + hash(i) * 1.4, BR, 6); b.sphere(x, 6 + hash(i) * 1.4, z, 0.35, BR, { detail: 0 }); }
    b.box(24.8, 0, 86.4, 3, 0.5, 3, '#c8c1b4'); b.cyl(24.8, 0.5, 86.4, 0.4, 0.55, 2.6, BR, 6); b.sphere(24.8, 3.4, 86.4, 0.33, BR, { detail: 0 });
    b.colPolygon(p, { y1: 24 }); b.col(39.4, 98.6, 6.5, 7);
}
