// ============================================================================
//  Landmarks — Bucharest centre landmarks: Athenaeum, Royal Palace, Victoria Palace, CEC, MNIR, Marriott, Unirea, ASE, Ambasador, ARO.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { bucharestSourceMasses, cecSourceMasses } from './source-data.js';
import { pts, rect, ellipse, signedArea, centroid, bbox, offset, zAt, xAt, M } from './kit.js';
import { P } from './footprints.js';
import { flag, storeys, facadeQuad, edgeN } from './parts.js';
import { A } from './anchors.js';

// Ateneul Român (Albert Galleron, 1886-88) — 41 m to the top of the dome (OSM way 16291602), concert-hall
// rotunda under a ribbed dome; Ionic hexastyle portico with pediment (Commons "Ateneo Rumano, Bucarest,
// 2016-05-29, DD 73"): drum ring of oculi (round windows) between paired pilasters, dark grey-green dome with
// dormers and gilded ribs, lantern; lower two-storey wings left and right of the portico.
// Src: https://en.wikipedia.org/wiki/Romanian_Athenaeum ; OSM way 16291602
export function bAteneu(b) {
    const S = '#f1ead9', TR = '#e5dbc6', D = '#5d6964', GOLD = '#d4b46a', WIN = '#56524a';
    b.wall = S;
    const cx = -4;
    // rear block + side wings
    const rear = rect(-33, -19, -12, 19); b.prism(rear, 0, 14, S, { topCol: '#cfc6b3' });
    b.windows(rear, 0, 13, 6.2, WIN, { bay: 4, wf: 0.4, hf: 0.6, arch: true, minL: 6 }); b.cornice(rear, 13.4, 0.8, 0.6, TR);
    for (const s of [-1, 1]) {
        const w = rect(4, s > 0 ? 13 : -24.5, 24.5, s > 0 ? 24.5 : -13);
        b.prism(w, 0, 13, S, { topCol: '#cfc6b3' }); b.windows(w, 0, 12.5, 6, WIN, { bay: 3.6, wf: 0.42, hf: 0.6, arch: true, minL: 5 });
        b.cornice(w, 12.4, 0.8, 0.6, TR); b.colonnade(24.8, s * 14.5, 24.8, s * 23.5, 1.5, 10.5, 3, 0.45, '#f6f1e6', { seg: 6 });
    }
    // rotunda: lower wall with arched windows, cornice, drum with oculi + paired pilasters
    b.cyl(cx, 0, 0, 20.5, 21, 19, S, 28);
    b.windows(ellipse(cx, 0, 21.2, 21.2, 14, Math.PI / 14), 1, 18, 8.5, WIN, { bay: 9.4, wf: 0.3, hf: 0.66, arch: true, minL: 4 });
    b.cyl(cx, 19, 0, 21.8, 21.8, 1.4, TR, 28);
    const drum = ellipse(cx, 0, 18, 18, 24, Math.PI / 24);
    b.prism(drum, 20.4, 26.5, S, { top: false });
    for (let i = 0; i < 12; i++) {
        const a = (i + 0.5) / 12 * Math.PI * 2;
        b.geo(new THREE.TorusGeometry(1.15, 0.28, 4, 10), TR, M(cx + Math.cos(a) * 18.15, 23.4, Math.sin(a) * 18.15, -a + Math.PI / 2));
        b.cyl(cx + Math.cos(a) * 18.05, 23.4, Math.sin(a) * 18.05, 1.05, 1.05, 0.2, '#4b5560', 10, { rx: Math.PI / 2, ry: -a + Math.PI / 2 });
        const a2 = i / 12 * Math.PI * 2;
        for (const d of [-0.035, 0.035]) b.box(cx + Math.cos(a2 + d) * 18.25, 20.4, Math.sin(a2 + d) * 18.25, 0.5, 6.1, 0.5, TR);
    }
    b.cyl(cx, 26.5, 0, 19, 19, 1.2, TR, 24);
    // ribbed dome with dormers, lantern
    // OSM w16291602 height=41 includes the crown; the former estimated dome/lantern reached 47.4 m.
    // Keep the documented total height. The distribution of the rise remains an explicit modelling estimate.
    const roofScale = (41 - 27.7) / (47.4 - 27.7);
    b.push(M(0, 27.7 * (1 - roofScale), 0, 0, 1, roofScale, 1));
    const pr = [[18.2, 0], [17.5, 3.5], [15.6, 7], [12.4, 10], [8.2, 12.3], [3.6, 13.4], [0.01, 13.6]].map(([a, c]) => new THREE.Vector2(a, c));
    b.geo(new THREE.LatheGeometry(pr, 24), D, M(cx, 27.7, 0));
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        b.tube([[cx + Math.cos(a) * 18.3, 27.8, Math.sin(a) * 18.3], [cx + Math.cos(a) * 15.8, 34.6, Math.sin(a) * 15.8], [cx + Math.cos(a) * 8.4, 40, Math.sin(a) * 8.4], [cx + Math.cos(a) * 2.6, 41.2, Math.sin(a) * 2.6]], 0.3, GOLD, { seg: 4, radial: 3 });
        const a3 = a + Math.PI / 12; b.box(cx + Math.cos(a3) * 16.5, 29.5, Math.sin(a3) * 16.5, 1.4, 2.2, 1.6, '#e8e1d0', { ry: -a3 });
    }
    b.cyl(cx, 41, 0, 2.2, 2.6, 2.6, '#e8e1d0', 10); b.dome(cx, 43.6, 0, 2.3, 1.8, D, 10); b.cyl(cx, 45.2, 0, 0.12, 0.25, 2.2, GOLD, 6);
    b.pop();
    // portico (+x): steps, Ionic hexastyle (+ return columns), entablature with the ATHENEUL ROMAN frieze, pediment
    for (let i = 0; i < 4; i++) b.box(29 - i * 0.6, i * 0.5, 0, 12 - i * 1.2, 0.5, 30 - i * 0.4, '#ddd3bf');
    b.box(14, 2, 0, 10, 13.2, 28, S);
    // portico back wall: rusticated joints, two carved wooden doors with fanlights, five gold mosaic roundels
    for (let k = 0; k < 6; k++) b.box(19.06, 2.2 + k * 1.15, 0, 0.08, 0.06, 26, '#dacfb8');
    for (const z of [-4.8, 0, 4.8]) { b.box(19.1, 2, z, 0.3, 7.2, 3, TR); b.box(19.2, 2, z, 0.25, 5.4, 2.3, '#5a4128'); b.box(19.22, 7.4, z, 0.2, 1.5, 2.3, '#8a7a55', { mat: 'g' }); }
    for (let i = 0; i < 5; i++) { const z = -9.6 + i * 4.8; b.cyl(19.15, 9.6, z, 1.15, 1.15, 0.2, TR, 14, { rz: Math.PI / 2 }); b.cyl(19.3, 9.6, z, 0.95, 0.95, 0.12, '#c9a24e', 14, { rz: Math.PI / 2, mat: 'g' }); }
    const ionic = (x, z) => {                                                   // Attic base, fluted-looking 12-sided shaft, Ionic capital
        b.box(x, 2, z, 1.9, 0.35, 1.9, TR); b.cyl(x, 2.35, z, 0.92, 0.98, 0.45, TR, 12);
        b.cyl(x, 2.8, z, 0.66, 0.76, 10.2, '#f6f1e6', 12);
        b.cyl(x, 13, z, 0.82, 0.7, 0.35, TR, 12);
        for (const s2 of [-1, 1]) b.cyl(x, 13.05, z + s2 * 0.82, 0.36, 0.36, 1.7, '#efe8d8', 8, { rz: Math.PI / 2 });
        b.box(x, 13.4, z, 1.75, 0.22, 2.05, TR);
    };
    for (let i = 0; i < 6; i++) ionic(26.2, -12 + i * 4.8);
    for (const z of [-12, 12]) ionic(21.6, z);
    // entablature: three-fascia architrave, frieze with the inscription, dentilled cornice
    b.box(21, 13.62, 0, 12, 0.36, 28.6, TR); b.box(21.05, 13.98, 0, 12.1, 0.36, 28.7, TR); b.box(21.1, 14.34, 0, 12.2, 0.36, 28.8, TR);
    b.box(21, 14.7, 0, 12, 1.2, 28.6, S);
    b.text('ATHENEUL ROMAN', 27.02, 14.72, 0, Math.PI / 2, 0.74, '#a3926f');
    for (let i = 0; i < 46; i++) b.box(27.2, 15.9, -14.35 + i * 0.638, 0.3, 0.28, 0.3, TR);
    b.box(21.2, 16.18, 0, 12.6, 0.45, 29.6, TR);
    b.pediment(21, 16.63, 0, 29, 5.3, 12, S, Math.PI / 2);
    // raking cornices + acroteria (gilded lyres at the apex and corners)
    const ang = Math.atan2(5.3, 14.5), Lr = Math.hypot(5.3, 14.5);
    for (const s2 of [-1, 1]) b.box(21.3, 16.63 + 2.65 - 0.2, s2 * 7.25, 12.7, 0.55, Lr + 0.8, TR, { rx: s2 * ang });
    for (const [z, y] of [[0, 22.1], [-14.6, 16.9], [14.6, 16.9]]) { b.box(26.5, y, z, 1, 0.5, 1, TR); b.box(26.5, y + 0.5, z, 0.25, 1.4, 0.9, '#b9974c', { mat: 'g' }); }
    b.colPolygon(pts(P.ateneu[0]), { y1: 26.5 });
}

// Palatul Regal (Royal Palace, now MNAR; N. Nenciulescu 1927-37 rebuild) — OSM way 232472401 (250 x 86 m, flat roof).
// The main front faces EAST-NORTH-EAST onto Calea Victoriei / Piața Revoluției: a cour d'honneur (model -z side, x ≈ -36..59,
// ≈ 40 m deep) framed by the north and south wings. Limestone ashlar (#E1D6BC), rusticated ground floor with arched
// windows, giant fluted Corinthian columns in pairs on pedestals spanning the two upper storeys, dentilled cornice,
// balustraded attic; iron-and-glass marquee over the main door (Commons "49-53, Calea Victoriei, Bucharest (Romania)",
// "The porch of the Royal Palace of Bucharest"). Model frame: +x = SSE along the street, -z = ENE (towards the square).
// Src: https://en.wikipedia.org/wiki/Royal_Palace,_Bucharest ; OSM way 232472401
export function bRegal(b) {
    const S = '#e1d6bc', TR = '#d8ccb0', WIN = '#4f565a', COL = '#ebe2cd';
    b.wall = S;
    const [p] = P.regal.map(pts);
    // The 12 m primary outline is not a uniform facade-height instruction: the complete OSM part survey
    // maps 4 m plinths, 14 m pilasters/columns, 15.7/16 m bodies and 18 m upper returns.
    // Preserve those 263 explicit part boundaries and min_height bands instead of the prior uniform 19.9 m mass.
    for (const layer of bucharestSourceMasses().regal.layers) {
        for (const q of layer.polygons) {
            // (round 2, 2026-11-12) The mapped colour name "palegoldenrod" (#eee8aa) read olive in shade, and the one window row
            // asked for 6 m wall runs that the pilaster-detailed rings hardly have. Limestone as in the walk scene (#e1d6bc,
            // Street View from Piața Revoluției 2024: warm cream ashlar, darker rusticated ground floor) and one window per
            // wall panel on the three storeys the palace shows: arched ground floor, tall first floor, lower second floor.
            b.prism(q.ring,layer.y0,layer.height,layer.height<=5.7?TR:S,{holes:q.holes,top:false});
            const st=layer.y0===1.5?[1.5,4.3,2.8,0.55,true]:layer.y0===5.7?[5.7,10,4.3,0.66,false]:layer.y0===10?[10,12,2,0.74,false]:null;
            if(st)b.windows(q.ring,st[0],st[1],st[2],WIN,{bay:4.2,wf:0.42,hf:st[3],arch:st[4],minL:2.3,start:st[2]*0.16});
            b.colPolygon(q.ring,{holes:q.holes,y0:layer.y0,y1:layer.height});
        }
        for (const q of layer.caps) b.cap(q.ring,layer.height,layer.height>=15.7?'#c0c0c0':'#d8ccb0',q.holes);
    }
    // Entry details from independent facade photographs; positions remain explicit modelling estimates.
    const fz = (x) => (zAt([p], x)?.[0] ?? 2);
    // main door + iron-and-glass marquee
    const zd = fz(10); b.box(10, 0, zd - 0.15, 3.4, 5, 0.3, '#5b4a35'); b.box(10, 4.6, zd - 3, 9, 0.35, 6, '#2c3134', { mat: 'g' }); b.box(10, 4.95, zd - 3, 8.4, 0.12, 5.6, '#9db0b8', { mat: 'g' });
    for (const s2 of [-1, 1]) b.box(10 + s2 * 4.3, 0, zd - 5.6, 0.2, 4.6, 0.2, '#2c3134');
    // court paving + the iron railing with stone pillars closing the court on Calea Victoriei
    b.prism(rect(-36, -40, 59, fz(10) - 0.5), 0, 0.06, '#c9c4b8');
    b.fence([[-55, -42], [-8, -44], [28, -44], [75, -36]], 2.4, 7, '#22272a', { post: 0.7, postCol: '#d6ccb4', base: 0.6, baseCol: '#d6ccb4', bars: 0.35 });
    b.cyl(-6, 0, -2 + fz(-6), 0.1, 0.14, 12, '#dddddd', 6); flag(b, -6, 11.8, -2 + fz(-6), 2.6);
    // (round 4, r2-landmarks-3) the court front of the central body (x -28..52, z = fz(x)): paired giant columns on pedestals
    // over the rusticated ground floor (5.7 m) up to the cornice, a dentilled cornice and the attic balustrade on the 15.7 m
    // roofline (Commons "49-53, Calea Victoriei", Street View from Piața Revoluției 2024). Pair spacing follows the 4.2 m window
    // bay (one pair per two bays); column radius, cornice depth, dentil and baluster pitch are estimates.
    const BAY = 4.2;
    for (let x0 = -28; x0 + BAY <= 52.01; x0 += BAY) {
        const xm = x0 + BAY / 2, z0 = fz(xm);
        b.box(xm, 13.75, z0 - 0.35, BAY, 0.25, 0.7, TR); b.box(xm, 14.0, z0 - 0.45, BAY, 0.55, 0.9, S); // architrave band + cornice
        for (let k = 0; k < 7; k++) b.box(x0 + 0.3 + k * 0.6, 13.6, z0 - 0.68, 0.22, 0.15, 0.18, TR); // dentils under the cornice
        b.box(xm, 15.7, z0 - 0.2, BAY, 0.18, 0.5, TR); b.box(xm, 16.45, z0 - 0.2, BAY, 0.15, 0.55, TR); // balustrade base and rail
        for (let k = 0; k < 10; k++) b.cyl(x0 + 0.21 + k * 0.42, 15.88, z0 - 0.2, 0.07, 0.1, 0.57, COL, 6); // balusters
    }
    for (let x = -28 + BAY; x < 52; x += BAY * 2) for (const s2 of [-0.75, 0.75]) {
        const zc = fz(x + s2) - 0.55;
        b.box(x + s2, 5.7, zc, 1.0, 0.9, 1.0, TR); b.cyl(x + s2, 6.6, zc, 0.36, 0.42, 7.0, COL, 12); b.box(x + s2, 13.6, zc, 0.95, 0.15, 0.95, TR); // pedestal, shaft, capital
    }
}

// Palatul Victoria (Government, Duiliu Marcu, 1937-52) — OSM way 23554419 + parts 1516914665 (20 m),
// 1516952164 (23 m), 1516952165 (30 m core, green-copper roof #8fbc8f). Stripped-classical travertine block:
// regular grid of tall windows, high ground floor, full-width giant order of square pillars + entrance
// portico to Piața Victoriei (+z, faces the square to the W/SW), travertine #D9CDB4, two flagpoles,
// attic storey set back, flag mast.
// Src: https://en.wikipedia.org/wiki/Victoria_Palace ; OSM way 23554419 + parts 1516914665/1516952164/1516952165
export function bVictoria(b) {
    const S = '#d9cdb4', TR = '#cec1a5', WIN = '#4c5157';   // travertine #D9CDB4 (research bucharest-romana.json landmarks[victoria])
    b.wall = S;
    const [p] = P.victoria.map(pts);
    // Complete mapped part envelopes (20/23/30 m core, 34 m returns), with exact concave source roofs.
    // Interval unions remove coincident internal caps and preserve courtyard recesses and the 7–9 m bridge.
    for (const layer of bucharestSourceMasses().victoria.layers) {
        for (const q of layer.polygons) {
            b.prism(q.ring, layer.y0, layer.height, S, { holes: q.holes, top: false });
            if (layer.y0 < 20 && layer.height - layer.y0 > 2) b.windows(q.ring, layer.y0, layer.height, 4.2, WIN, { bay: 3.9, wf: 0.4, hf: 0.62, minL: 5 });
            b.colPolygon(q.ring, { holes: q.holes, y0: layer.y0, y1: layer.height });
        }
        for (const [key, color, mat] of [['caps', '#dcdcdc', 'm'], ['greenCaps', '#8fbc8f', 'm'], ['glassCaps', '#7898a2', 'g']])
            for (const q of layer[key]) b.cap(q.ring, layer.height, color, q.holes, 1, mat);
    }
    // full-width giant order on Piața Victoriei (Commons "Bucharest Victoria Palace-2.jpg"): square pillars
    // from the plinth storey to the attic cornice, projecting entrance bay in the middle
    b.colonnade(-44, 22.6, 44, 22.6, 6, 13.6, 20, 0.6, '#f1ede4', { square: true });
    b.box(0, 19.6, 22.4, 92, 0.9, 1.6, TR);
    b.box(-1.2, 0, 34.5, 24, 1, 6, '#cfc6b3');
    b.colonnade(-10, 36.4, 7.6, 36.4, 1, 15.5, 6, 0.7, '#f1ede4', { square: true });
    b.box(-1.2, 16.5, 35.5, 22, 2.2, 3.2, TR);
    b.cyl(-1.2, 30, -9, 0.12, 0.16, 9, '#dddddd', 6); flag(b, -1.2, 38.8, -9, 3);
    // the two flagpoles in front of the portico (Romania + EU) — research: "19-bay arcade/colonnade; two flagpoles"
    for (const [x, eu] of [[-16, false], [13.6, true]]) {
        b.cyl(x, 0, 41, 0.1, 0.16, 15, '#e3e3e3', 6); b.box(x, 0, 41, 0.9, 0.5, 0.9, '#bdb4a0');
        if (eu) b.box(x + 1.5, 12.6, 41, 3, 2, 0.05, '#003399'); else flag(b, x, 14.6, 41, 3);
    }

}

// Palatul CEC (Paul Gottereau,1897–1900): exact44×60m OSM parent/part complex.
// 162 source volumes include the seven relation outers introduced by the part-only audit.
// Literal total heights reach37.5m; nine absent totals and unmapped roof rises remain estimates.
// Full source provenance and unsupported raw roof forms: research/landmark-cec-source-assemblies.json.
export function bCEC(b) {
    const S = '#e2d6bb', TR = '#d6c8a8', WIN = '#4a4943', COL = '#ece4d0';
    b.wall = S;
    const source = cecSourceMasses();
    // Exact source masses replace the old uniform slab and guessed dome bodies.
    // Body bands are physical unions; source-native roof clipping removes coplanar overlap.
    for (const f of source.walls) b.quad(...f.vertices, f.colour, f.material, f.normal);
    for (const f of source.roofs) b.tri(...f.vertices, f.colour, f.material, [0, 1, 0]);
    for (const f of source.roofWalls) b.tri(...f.vertices, f.colour, f.material, f.normal);
    const outerOrdinals = new Map();
    for (const v of source.volumes) {
        const outer = outerOrdinals.get(v.sourceId) || 0; outerOrdinals.set(v.sourceId, outer + 1);
        b.colPolygon(v.ring, { holes: v.holes, y0: v.minimumM, y1: v.totalM });
        Object.assign(b.cols[b.cols.length - 1], { sourceId: v.sourceId, sourceOuter: outer, sourceHeight: v.roofProfile.heightSource });
    }
    b.sourceMassAudit = { sourceDatasetSha256: source.sourceDatasetSha256, sourceVolumes: source.volumes.map(v => ({ sourceId: v.sourceId, sourceIndex: v.sourceIndex, totalM: v.totalM, minimumM: v.minimumM, holes: v.holes.length, heightSource: v.roofProfile.heightSource })), roofIssues: source.volumes.filter(v => v.roofProfile.issues?.length).map(v => ({ sourceId: v.sourceId, issues: v.roofProfile.issues })) };

    // Facade ornament remains explicitly modelled rather than a second structural mass.
    // Its lower-storey placement is an estimate; every source solid above remains intact.
    const [p] = P.cec.map(pts);
    b.windows(p, 0.5, 12.3, 6, WIN, { bay: 4.4, wf: 0.45, hf: 0.62, arch: true, minL: 5 });
    for (const y of [0.8, 2.2, 6.5, 12.3]) b.cornice(p, y, 0.1, 0.07, '#cbbd9d');
    const xf = xAt([p], 0)?.[1] ?? 22, xr = xf - 2.2;
    b.geo(new THREE.TorusGeometry(7.3, 0.32, 4, 20, Math.PI), TR, M(xf + 0.08, 10.5, 0, Math.PI / 2));
    b.geo(new THREE.TorusGeometry(5.2, 0.26, 4, 16, Math.PI), TR, M(xf + 0.12, 10.4, 0, Math.PI / 2));
    b.box(xr, 0, 0, 0.3, 5.8, 3.6, '#4a3a2a');
    for (const z of [-2.8, 2.8]) b.box(xr + 0.05, 7.4, z, 0.25, 3.2, 1.8, WIN);
    b.box(xr + 0.6, 6.6, 0, 1.2, 0.3, 9, TR);
    b.fence([[xr + 1.15, -4.4], [xr + 1.15, 4.4]], 1, 1.1, '#2e3335', { post: 0.08 });
    b.cyl(xr + 0.2, 12.4, 0, 1.1, 1.1, 0.3, '#f1ece0', 16, { rz: Math.PI / 2 });
    b.box(xr + 0.35, 12.3, 0, 0.1, 0.8, 0.1, '#222');
    b.box(xr + 0.35, 12.35, 0.2, 0.1, 0.1, 0.5, '#222');
    for (const z of [-6.8, -5.3, 5.3, 6.8]) b.cyl(xf + 0.08, 2.2, z, 0.38, 0.42, 10.4, COL, 10);
    // (round 2, 2026-11-12; found by the Old Town walk-scene review) The mapped parts step up to the lanterns as flat rings
    // (roof:shape=dome / onion are not supported by the source roofs), so the palace read as five stepped boxes with rods:
    // no dome was seen from Calea Victoriei. Dome shells over those steps: the glass-and-metal central dome above the
    // 25 m crossing (source centre -1.4, 1.2; lantern w657898053 to 37.5 m stays visible above it) and the four corner
    // pavilion domes (source drums w657898126 / w657898137 and the two western ones, lanterns to 32.5 - 35 m). Shell radii
    // and rises are estimates fitted inside the mapped totals; no source volume is removed and the 37.5 m maximum is kept.
    b.dome(-1.4, 24.6, 1.2, 8.4, 9.6, '#8d9da3', 20, { mat: 'g' });
    b.cyl(-1.4, 24.2, 1.2, 8.5, 8.7, 0.9, TR, 20);
    for (const [x, z] of [[13.5, -25.9], [13.4, 25.2], [-16.5, 25.7], [-16.9, -25.8]]) { b.dome(x, 25.2, z, 4.5, 6.6, '#727a80', 12); b.cyl(x, 25, z, 4.6, 4.7, 0.5, TR, 12); }
}

// Muzeul Național de Istorie a României (Palatul Poștelor, Alexandru Săvulescu, 1894-1900) — ≈ 22 m,
// neoclassical; portico of 14 Doric columns ("loggia") between end pavilions on Calea Victoriei (-x),
// mansard roof; OSM rel 19919941 (+ courtyard). Trajan's Column replica stands in the inner courtyard.
// Src: https://en.wikipedia.org/wiki/National_Museum_of_Romanian_History ; OSM rel 19919941
export function bMNIR(b) {
    const S = '#e8e0cf', TR = '#ddd3bf', WIN = '#4f4a43';
    b.wall = S;
    const [p, hole] = P.mnir.map(pts);
    storeys(b, p, 0, [[6.5, 0.44, 0.66, true], [5.6, 0.4, 0.62, false], [5, 0.38, 0.55, false]], { wall: S, win: WIN, trim: TR, bay: 4.4, holes: [hole], courses: [0], pilasters: true, pilasterEvery: 2, corniceOut: 0.9, parapet: 1.1, minL: 6 });
    b.sourceRoof(p, 19.2, 4, '#8f9599', 4.5, { holes: [hole], mansard: true });
    const xf = xAt([p], 0)?.[0] ?? -52;
    b.box(xf - 5, 0, 0, 10, 3, 62, '#cfc6b3');
    for (let i = 0; i < 4; i++) b.box(xf - 10.5 + i * 0.6, i * 0.75, 0, 1.2, 0.75, 44, '#d8cfbd');
    b.colonnade(xf - 8.2, -26, xf - 8.2, 26, 3, 13.2, 14, 1, '#f3eee3', { capital: TR, seg: 10 });
    b.box(xf - 5, 16.2, 0, 10.6, 2.6, 62, TR); b.box(xf - 5, 18.8, 0, 9.6, 1.5, 60, S);
    b.text('MUZEUL NATIONAL DE ISTORIE A ROMANIEI', xf - 10.32, 16.75, 0, -Math.PI / 2, 0.85, '#7a6b52');
    for (const z of [-36, 36]) { b.box(xf + 3, 0, z, 10, 24.5, 14, S); b.windows(rect(xf - 2, z - 7, xf + 8, z + 7), 0, 23, 6.5, WIN, { bay: 4.6, wf: 0.4, hf: 0.6, arch: true, minL: 4 }); b.hip(xf + 3, 24.5, z, 10, 14, 1.6, '#8f9599'); b.dome(xf + 3, 25.2, z, 4.7, 5.6, '#7d858a', 12); b.cyl(xf + 3, 30.6, z, 0.25, 0.5, 1.6, '#7d858a', 6); } // (round 2: the end pavilions carry domes — Old Town walk-scene review, Calea Victoriei 2024; radius / rise estimated, the hip stays as their low base)
    // Trajan's Column replica (cast, 1967) in the courtyard
    const [hx, hz] = centroid(hole); b.cyl(hx, 0, hz, 2, 2, 3, '#d9d1c1', 8); b.cyl(hx, 3, hz, 1.6, 1.8, 24, '#d6cdb9', 10); b.box(hx, 27, hz, 2.4, 1.2, 2.4, '#d9d1c1');
    b.colPolygon(p, { holes: [hole], y1: 19.2 });
}

// JW Marriott Bucharest Grand Hotel (ex-Casa Republicii annex, 1980s, opened 2000) — 9 levels / 40 m
// (OSM way 26314111) with 13-16 m inner wings (parts 1190458135-38). Same cream stone language as the
// Parliament: arcaded ground floor, regular grid, arched top storey, set-back attic, porte-cochère + sign.
// Src: https://en.wikipedia.org/wiki/JW_Marriott_Bucharest_Grand_Hotel ; OSM way 26314111
export function bMarriott(b) {
    const S = '#ece4d1', TR = '#e2d8c2', WIN = '#56606a';
    b.wall = S;
    const [p] = P.marriott.map(pts);
    // 40 m / nine-level perimeter, with the actual 13/15/16 m inner wings cut out above their roofs.
    for (const q of bucharestSourceMasses().marriott.high) {
        storeys(b, q.ring, 0, [[5.6,0.5,0.7,false], ...Array.from({length:8},()=>[4.225,0.4,0.58,false])],
            { holes:q.holes, wall:S, win:WIN, trim:TR, bay:4.4, courses:[0,7], pilasters:true, pilasterEvery:2, corniceH:0.6, corniceOut:0.55, minL:6 });
        b.colPolygon(q.ring,{holes:q.holes,y1:40});
    }
    for (const part of bucharestSourceMasses().marriott.parts) for (const q of part.polygons) {
        b.prism(q.ring,part.y0,part.height,part.roof?'#7896a0':S,{holes:q.holes,topCol:part.grass?'#7e9368':part.roof?'#7896a0':'#cbc5b8',mat:part.roof?'g':'m'});
        if(!part.roof)b.colPolygon(q.ring,{holes:q.holes,y0:part.y0,y1:part.height});
    }
    const xf = xAt([p], 0)?.[1] ?? 40;
    b.box(xf + 6, 6, 0, 12, 1, 22, TR); b.colonnade(xf + 11, -9, xf + 11, 9, 0, 6, 4, 0.5, '#f3eee4', { seg: 6 });
    b.text('JW MARRIOTT', xf + 12.05, 6.15, 0, Math.PI / 2, 0.7, '#2c2c2c');

}

// Unirea Shopping Center (1976, enlarged 1989, refurbished 2000s) — 4 floors + roof levels, 6 levels in OSM
// (way 23492027), 43,760 m² (en.wikipedia). Long curved glass front on Piața Unirii (-x side) with the red
// "UNIREA" lettering, beige stone end walls; multi-storey car park block behind (OSM 184169515, not modelled).
// Src: https://en.wikipedia.org/wiki/Unirea_Shopping_Center (43,760 m², 4 floors) ; OSM way 23492027
/** An inward offset of a footprint that stays inside it and does not fold over itself: the first of `insets` (m) that
 *  does, or null. */
function safeInset(poly, insets) {
    const inside = (x, z) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > z) !== (zj > z)) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
    const cross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
    for (const d of insets) {
        const q = offset(poly, -d); if (!q || q.length < 3) continue;
        if (!q.every(([x, z]) => inside(x, z))) continue;
        let simple = true; for (let i = 0; i < q.length && simple; i++) for (let j = i + 2; j < q.length; j++) { if (i === 0 && j === q.length - 1) continue; if (cross(q[i], q[(i + 1) % q.length], q[j], q[(j + 1) % q.length])) { simple = false; break; } }
        if (simple) return q;
    }
    return null;
}
export function bUnirea(b) {
    const [p] = P.unirea.map(pts);
    // Independent 2017 façade reference: opaque ribbed metal skin over a glazed ground floor.
    // The earlier all-glass elevation and large fabricated name panel did not match it.
    // (round 2, 2026-11-12) Street View from Piața Unirii (44.42700, 26.10377, May 2024): the south front and the
    // south-west rotunda are large flat white-grey panels with a blank white billboard frame on the curve; the west front on
    // Bd. I. C. Brătianu is a dark bronze louvred wall carrying full-height advertising banners; a white canopy band runs
    // over the recessed glazed ground floor. The uniform grey ribbed skin (a 2017 reference) matched neither. Panel module,
    // louvre pitch and the banner size are estimates; the banner is a plain canvas (its advertising is not reproduced).
    const LIGHT='#d3d4d0',JOINT='#a4a7a5',DARK='#6a655d',SLAT='#817a70',sg=signedArea(p)>0?1:-1;
    b.prism(p,0,24,LIGHT,{topCol:'#aaa9a3'});
    b.windows(p,0.3,4.9,4.8,'#415564',{bay:3.2,wf:0.9,hf:0.84,start:0.2,mat:'g',minL:4});
    for(const y of [9.9,14.4,18.9]) b.ring(offset(p,0.06),y,y+0.07,JOINT);
    for(let i=0;i<p.length;i++){
        const a=p[i],c=p[(i+1)%p.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(L<1.2)continue;
        const dx=(c[0]-a[0])/L,dz=(c[1]-a[1])/L,n=[sg*dz,-sg*dx],at=(t,o)=>[a[0]+dx*t+n[0]*o,a[1]+dz*t+n[1]*o];
        const q=(t0,t1,y0,y1,o,col,mat)=>{const u=at(t0,o),v=at(t1,o);b.quad([u[0],y0,u[1]],[v[0],y0,v[1]],[v[0],y1,v[1]],[u[0],y1,u[1]],col,mat||'m',[n[0],0,n[1]]);};
        if(i===24){ // the west front (129 m): louvred bronze wall + one banner next to the rotunda
            q(0,L,5.4,23.4,0.1,DARK);for(let y=5.9;y<23;y+=0.95)q(0,L,y,y+0.16,0.17,SLAT);
            q(L-40,L-9,6.6,22.4,0.3,'#a8322f');q(L-40,L-9,6.6,7.0,0.34,'#e9e6df');q(L-40,L-9,22.0,22.4,0.34,'#e9e6df');
        }else if(L>=5){const k=Math.max(1,Math.round(L/6.2));for(let j=1;j<k;j++)q(j/k*L-0.04,j/k*L+0.04,5.4,23.4,0.06,JOINT);}
        if(i>=34&&i<=41)q(0,L,11.5,20.5,0.3,'#f1f1ee'); // the blank billboard frame on the rotunda
    }
    // (round 4, r2-landmarks-4) the red "UNIREA" logo near the roof at the west end of the south front (May 2024 panorama from
    // Piața Unirii): on the longest face whose outward normal points most to the south (world +z; model -> world by A.unirea's
    // rotation). Letter height and the inset from the corner are estimates; the logo's exact artwork is not reproduced.
    {
        const rot=A.unirea[2],c0=Math.cos(rot),s0=Math.sin(rot);let best=null;
        for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length],L=Math.hypot(c[0]-a[0],c[1]-a[1]);if(L<25)continue;const dx=(c[0]-a[0])/L,dz=(c[1]-a[1])/L,n=[sg*dz,-sg*dx],wz=-n[0]*s0+n[1]*c0;if(!best||wz>best.wz)best={a,dx,dz,n,L,wz};}
        if(best&&best.wz>0.5){const {a,dx,dz,n,L}=best,t=Math.min(L-9,14),o=0.45,x=a[0]+dx*t+n[0]*o,z=a[1]+dz*t+n[1]*o,ry=Math.atan2(n[0],n[1]); // (text faces n, reads left to right from outside)
            b.text('UNIREA',x+n[0]*0.08,20.0,z+n[1]*0.08,ry,2.3,'#d0202a');}
    }
    b.cornice(p,4.8,0.55,0.45,'#e3e3de');b.cornice(p,23.4,0.6,0.35,'#b9bbb7');
    // (owner, 2026-11-11: "this still sticks out") The roof storey is the footprint inset by 12 m. On this concave outline
    // a plain 12 m inset folds over itself and a slab of it stood out over the street. The inset is used only when every
    // vertex of it lies inside the footprint and no two of its edges cross; otherwise a smaller one, or none.
    const top = safeInset(p, [12, 9, 6]); if (top) b.prism(top,24,28.5,'#c9c4b9',{topCol:'#aaa69e'});
    b.colPolygon(p,{y1:24});
    // Footbridge from the Unirea car park to the Carrefour building: OSM w231671712 (highway=footway bridge=yes layer=1),
    // 44.4287328,26.1057608 → 44.4286687,26.105621, 13 m across the paved alley. Street-level look (2026): an enclosed
    // glazed walkway one storey up with the Carrefour name on both sides. Deck height / section are estimates (no OSM metres).
    {
        const [la0, lo0, rot] = A.unirea, c = Math.cos(rot), s = Math.sin(rot);
        const loc = (la, lo) => { const dx = (lo - lo0) * 111132 * Math.cos(la0 * Math.PI / 180), dz = -(la - la0) * 111132; return [dx * c - dz * s, dx * s + dz * c]; };
        const [x0, z0] = loc(44.4287328, 26.1057608), [x1, z1] = loc(44.4286687, 26.105621), L = Math.hypot(x1 - x0, z1 - z0);
        const ux = (x1 - x0) / L, uz = (z1 - z0) / L, Y0 = 6, H = 3, W = 3.2, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, ry = Math.atan2(-uz, ux);
        b.strut([x0, Y0 + 0.15, z0], [x1, Y0 + 0.15, z1], W + 0.3, 0.3, '#8d9296');               // deck
        b.strut([x0, Y0 + H / 2 + 0.3, z0], [x1, Y0 + H / 2 + 0.3, z1], W, H - 0.3, '#5f7f93', 'g'); // glazing
        b.strut([x0, Y0 + H + 0.15, z0], [x1, Y0 + H + 0.15, z1], W + 0.3, 0.3, '#c9ccce');       // roof
        for (const sd of [1, -1]) {
            const ox = -uz * sd * (W / 2 + 0.06), oz = ux * sd * (W / 2 + 0.06);
            b.strut([x0 + ox, Y0 + 0.75, z0 + oz], [x1 + ox, Y0 + 0.75, z1 + oz], 0.08, 0.9, '#f4f5f6'); // white name band
            for (let t = 0; t <= L + 0.01; t += L / 6) b.strut([x0 + ux * t + ox, Y0 + 0.3, z0 + uz * t + oz], [x0 + ux * t + ox, Y0 + H, z0 + uz * t + oz], 0.1, 0.1, '#d9dcde'); // mullions
            b.text('Carrefour', mx + ox * 1.05, Y0 + 0.5, mz + oz * 1.05, sd > 0 ? ry : ry + Math.PI, 0.5, '#1e4fa3');
        }
    }
}

// ASE — Ion N. Angelescu: source rings r2274298 (2026-11-08), including its mapped rounded corner and four courts.
// Official facade/roof photographs: ase.ro/app/uploads/2023/02/ase-1.jpg and 2023/09/Cladire-ASE-panorama-600x500.jpg.
// Sources, estimates and remaining gaps: game/research/ase-landmark.json. No OSM height/level/roof tags exist here.
export function bASE(b) {
    const [outer, ...holes] = P.ase.map(pts), S = '#d2cec2', TR = '#e5e1d5', GL = '#2b343b', MET = '#aab7bf';
    const bb = bbox([outer]), all = [outer, ...holes], s = signedArea(outer) > 0 ? 1 : -1;
    b.wall = S;
    b.prism(outer, 0, 22, S, { holes, top: false });
    // Keep the entire mapped complex and its courts. A zero suppression radius avoids erasing neighbouring campus buildings.
    // Absolute model-space rings (not collider-centred); buildLandmark/world transform these together with their bounds.
    b.cols.push({ x: (bb.x0 + bb.x1) / 2, z: (bb.z0 + bb.z1) / 2, hw: (bb.x1 - bb.x0) / 2, hd: (bb.z1 - bb.z0) / 2, angle: 0, h: 22, poly: outer, holes });
    const distance = (x, z) => {
        let d = Infinity;
        for (const p of all) for (let i = 0; i < p.length; i++) {
            const a = p[i], c = p[(i + 1) % p.length], dx = c[0] - a[0], dz = c[1] - a[1];
            const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
            d = Math.min(d, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
        }
        return d;
    };
    // Grey sheet-metal roof around the courts, red pitched roof on the long north-west wing (Esri aerial inspection).
    // Refined source triangulation gives slopes without an unsafe inset across the narrow court-side wings.
    const contour = outer.map(p => new THREE.Vector2(...p)), hs = holes.map(h => h.map(p => new THREE.Vector2(...p))), points = contour.concat(...hs);
    const roofPoint = p => [p[0], 22.03 + Math.min(3.1, distance(...p) * 0.62), p[1]];
    let roofPoints = points.map(p => [p.x, p.y]), roofFaces = THREE.ShapeUtils.triangulateShape(contour, hs);
    // Split shared edges together so neighbouring roof facets cannot acquire cracks or mismatched heights.
    for (let pass = 0; pass < 9; pass++) {
        const mids = new Map(), next = [];
        for (const f of roofFaces) for (let i = 0; i < 3; i++) {
            const a = f[i], c = f[(i + 1) % 3], key = a < c ? `${a},${c}` : `${c},${a}`;
            if (mids.has(key) || Math.hypot(roofPoints[a][0] - roofPoints[c][0], roofPoints[a][1] - roofPoints[c][1]) <= 4) continue;
            mids.set(key, roofPoints.length); roofPoints.push([(roofPoints[a][0] + roofPoints[c][0]) / 2, (roofPoints[a][1] + roofPoints[c][1]) / 2]);
        }
        if (!mids.size) break;
        for (const f of roofFaces) {
            const mid = f.map((a, i) => { const c = f[(i + 1) % 3]; return mids.get(a < c ? `${a},${c}` : `${c},${a}`); });
            const n = mid.filter(i => i !== undefined).length;
            if (!n) { next.push(f); continue; }
            if (n === 3) { next.push([f[0], mid[0], mid[2]], [mid[0], f[1], mid[1]], [mid[2], mid[1], f[2]], mid); continue; }
            const k = n === 1 ? mid.findIndex(i => i !== undefined) : mid.findIndex(i => i === undefined), a = f[k], c = f[(k + 1) % 3], d = f[(k + 2) % 3];
            if (n === 1) next.push([a, mid[k], d], [mid[k], c, d]);
            else { const u = mid[(k + 1) % 3], v = mid[(k + 2) % 3]; next.push([d, v, u], [a, c, v], [c, u, v]); }
        }
        roofFaces = next;
    }
    roofFaces = roofFaces.map(f => {
        const [a, c, d] = f.map(i => roofPoints[i]);
        return (c[1] - a[1]) * (d[0] - a[0]) - (c[0] - a[0]) * (d[1] - a[1]) < 0 ? [f[0], f[2], f[1]] : f;
    });
    const redFaces = [], silverFaces = [], seam = new Map();
    const clipRoof = (f, north) => {
        const q = [];
        for (let i = 0; i < f.length; i++) {
            const a = f[i], c = f[(i + 1) % f.length], u = roofPoints[a], v = roofPoints[c], inside = north ? u[1] <= -0.54 : u[1] >= -0.54, other = north ? v[1] <= -0.54 : v[1] >= -0.54;
            if (inside) q.push(a);
            if (inside !== other) {
                const key = a < c ? `${a},${c}` : `${c},${a}`;
                if (!seam.has(key)) { const t = (-0.54 - u[1]) / (v[1] - u[1]); seam.set(key, roofPoints.length); roofPoints.push([u[0] + (v[0] - u[0]) * t, -0.54]); }
                q.push(seam.get(key));
            }
        }
        const faces = north ? redFaces : silverFaces;
        for (let i = 1; i + 1 < q.length; i++) faces.push(q[0], q[i], q[i + 1]);
    };
    for (const f of roofFaces) { clipRoof(f, true); clipRoof(f, false); }
    const roofGeometry = new THREE.BufferGeometry();
    roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roofPoints.flatMap(roofPoint), 3));
    roofGeometry.setIndex([...redFaces, ...silverFaces]); roofGeometry.computeVertexNormals();
    // Shared vertex normals avoid a false corrugated appearance on the conservative continuous roof approximation.
    for (const [faces, col] of [[silverFaces, MET], [redFaces, '#a85649']]) { const g = roofGeometry.clone(); g.setIndex(faces); b.geo(g, col); g.dispose(); }
    roofGeometry.dispose();
    for (const [y, h, out] of [[0.1, 0.5, 0.13], [4.4, 0.35, 0.26], [16.5, 0.35, 0.4], [18.1, 0.65, 0.68], [21.8, 0.25, 0.3]]) b.cornice(outer, y, h, out, TR, { holes });
    // Plain rear/courtyard elevations remain a simplified treatment: no invented shops or interior programme.
    b.windows(outer, 0.6, 17, 5.4, GL, { bay: 3.9, wf: 0.39, hf: 0.6, start: 0.3, mat: 'g', edges: [0, 1, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28] });
    b.windows([outer[2], [-42.04, -1], outer[0], outer[1]], 0.7, 21.5, 5.3, GL, { bay: 3.8, wf: 0.42, hf: 0.62, start: 0.2, mat: 'g', edges: [0] });
    for (const h of holes) {
        b.windows(h, 0.6, 21.5, 5.3, GL, { bay: 3.7, wf: 0.42, hf: 0.58, start: 0.4, mat: 'g', inward: true });
        b.cornice(h, 16.8, 0.25, -0.2, TR);
    }
    // Street elevations: rusticated base, giant engaged columns across the two upper levels, entablature, attic windows.
    const window = (x, z, dx, dz, nx, nz, y, w, h, arch = false) => {
        const T = (u, v, off) => [x + dx * u + nx * off, y + v, z + dz * u + nz * off];
        const pane = (ww, hh, off, col, mat) => {
            const r = ww / 2, spring = arch ? hh - r : hh;
            b.quad(T(-r, 0, off), T(r, 0, off), T(r, spring, off), T(-r, spring, off), col, mat, [nx, 0, nz]);
            if (arch) for (let i = 0; i < 8; i++) {
                const a = i * Math.PI / 8, c = (i + 1) * Math.PI / 8;
                b.tri(T(0, spring, off), T(Math.cos(a) * r, spring + Math.sin(a) * r, off), T(Math.cos(c) * r, spring + Math.sin(c) * r, off), col, mat, [nx, 0, nz]);
            }
        };
        pane(w + 0.3, h + 0.15, 0.09, '#68564a', 'm'); pane(w, h, 0.12, GL, 'g');
        b.quad(T(-0.035, 0, 0.14), T(0.035, 0, 0.14), T(0.035, h, 0.14), T(-0.035, h, 0.14), '#655344', 'm', [nx, 0, nz]);
        for (const yy of [h * 0.3, h * 0.76]) b.quad(T(-w / 2, yy, 0.14), T(w / 2, yy, 0.14), T(w / 2, yy + 0.06, 0.14), T(-w / 2, yy + 0.06, 0.14), '#655344', 'm', [nx, 0, nz]);
        b.strut(T(-w / 2 - 0.25, -0.16, 0.12), T(w / 2 + 0.25, -0.16, 0.12), 0.26, 0.18, TR);
    };
    const facade = (line, bays, columns = true) => {
        const ls = line.slice(1).map((p, i) => Math.hypot(p[0] - line[i][0], p[1] - line[i][1])), length = ls.reduce((a, c) => a + c, 0);
        const at = t => {
            let d = Math.min(length - 0.001, Math.max(0.001, t * length)), i = 0;
            while (i + 1 < ls.length && d > ls[i]) d -= ls[i++];
            const a = line[i], c = line[i + 1], dx = (c[0] - a[0]) / ls[i], dz = (c[1] - a[1]) / ls[i];
            return { x: a[0] + dx * d, z: a[1] + dz * d, dx, dz, nx: s * dz, nz: -s * dx };
        };
        for (let j = 0; j < bays; j++) {
            const q = at((j + 0.5) / bays), w = Math.min(1.85, length / bays * 0.48);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 0.85, w, 3.1);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 5.35, w, 4.8, true);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 11.6, w, 3.6);
            window(q.x, q.z, q.dx, q.dz, q.nx, q.nz, 19.1, w * 0.82, 2.25);
            const ry = -Math.atan2(q.dz, q.dx);
            b.box(q.x + q.nx * 0.16, 15.3, q.z + q.nz * 0.16, w + 0.65, 0.23, 0.35, TR, { ry });
            b.box(q.x + q.nx * 0.16, 21.4, q.z + q.nz * 0.16, w + 0.55, 0.2, 0.34, TR, { ry });
            for (let k = 0; k < 4; k++) {
                const t = (k / 3 - 0.5) * w, x = q.x + q.dx * t + q.nx * 0.28, z = q.z + q.dz * t + q.nz * 0.28;
                b.box(x, 4.72, z, 0.09, 0.54, 0.09, TR);
            }
        }
        if (columns) for (let j = 0; j <= bays; j++) {
            const q = at(j / bays), x = q.x + q.nx * 0.24, z = q.z + q.nz * 0.24;
            b.cyl(x, 4.9, z, 0.54, 0.64, 11.2, TR, 10);
            b.cyl(x, 4.62, z, 0.77, 0.77, 0.28, TR, 10); b.cyl(x, 16.1, z, 0.77, 0.62, 0.4, TR, 10);
        }
    };
    facade([[-42.04, -1], outer[3]], 8);
    facade(outer.slice(3, 12), 4);
    facade(outer.slice(11, 19), 7);
    // The mapped corner arc, not the footprint's extreme vertex, fixes the pavilion/dome position and diameter.
    // Least-squares fit of outer vertices 3..10: centre (-33.2975,32.9768), radius 7.085 m, max radial residual 0.186 m.
    const cx = -33.3, cz = 32.98, profile = [[6.85, 22.05], [6.96, 22.7], [6.8, 25], [6.35, 27.7], [5.3, 30.1], [3.6, 31.8], [1.35, 32.5]];
    b.cyl(cx, 21.8, cz, 7.12, 7.12, 0.4, TR, 32);
    for (let k = 0; k + 1 < profile.length; k++) for (let i = 0; i < 32; i++) {
        const [r0, y0] = profile[k], [r1, y1] = profile[k + 1], a = i / 32 * Math.PI * 2, c = (i + 1) / 32 * Math.PI * 2;
        b.quad([cx + Math.sin(a) * r0, y0, cz + Math.cos(a) * r0], [cx + Math.sin(c) * r0, y0, cz + Math.cos(c) * r0], [cx + Math.sin(c) * r1, y1, cz + Math.cos(c) * r1], [cx + Math.sin(a) * r1, y1, cz + Math.cos(a) * r1], MET, 'm', [Math.sin((a + c) / 2), 0.4, Math.cos((a + c) / 2)]);
    }
    for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2, ridge = profile.map(([r, y]) => [cx + Math.sin(a) * (r + 0.06), y, cz + Math.cos(a) * (r + 0.06)]);
        for (let k = 0; k + 1 < ridge.length; k++) b.strut(ridge[k], ridge[k + 1], 0.12, 0.12, '#d6dfe3');
        if (i % 2 === 0) {
            const x = cx + Math.sin(a) * 6.62, z = cz + Math.cos(a) * 6.62;
            b.geo(new THREE.CylinderGeometry(0.58, 0.58, 0.16, 12), '#d3dce0', M(x, 26.8, z, a, 1, 1, 1, Math.PI / 2));
            b.geo(new THREE.CylinderGeometry(0.39, 0.39, 0.19, 12), GL, M(x + Math.sin(a) * 0.03, 26.8, z + Math.cos(a) * 0.03, a, 1, 1, 1, Math.PI / 2), 'g');
        }
    }
    // Open lantern, small cap and finial; profile/vertical dimensions are estimates from the official photographs.
    b.cyl(cx, 32.5, cz, 1.22, 1.4, 0.45, TR, 12);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.cyl(cx + Math.sin(a), 32.95, cz + Math.cos(a), 0.11, 0.14, 2.5, TR, 6); }
    b.cyl(cx, 35.45, cz, 1.38, 1.2, 0.3, TR, 12); b.dome(cx, 35.75, cz, 1.18, 0.9, MET, 16); b.cyl(cx, 36.65, cz, 0.12, 0.15, 1.6, '#929d9f', 6);
    // Legible, photo-verified signs on the south face; street facade text is not repeated on the courtyard walls.
    const a = outer[11], c = outer[18], dx = c[0] - a[0], dz = c[1] - a[1], L = Math.hypot(dx, dz), nx = s * dz / L, nz = -s * dx / L, ry = Math.atan2(nx, nz);
    b.text('ACADEMIA DE STUDII ECONOMICE', (a[0] + c[0]) / 2 + nx * 0.5, 17.05, (a[1] + c[1]) / 2 + nz * 0.5, ry, 0.76, '#59564d');
    b.text('WWW.ASE.RO', (a[0] + c[0]) / 2 - nx * 2, 24.15, (a[1] + c[1]) / 2 - nz * 2, ry, 1.75, '#c32230');
    // OSM covered footways, preserving every mapped bend. OSM supplies layer 1, not a measured deck elevation/width.
    // Width 2.8 m, underside 5.2 m and 2.7 m enclosure are explicit provisional dimensions, not aerial measurements.
    const bridges = [
        [[34.7, 36.01], [55.95, 39.1], [57.65, 39.49], [58.86, 40.16], [59.7, 40.89], [60.96, 42.52]],
        [[7.57, 2.44], [8.34, -3.17]],
    ];
    for (const line of bridges) for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i], c = line[i + 1], dx = c[0] - a[0], dz = c[1] - a[1], len = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx), x = (a[0] + c[0]) / 2, z = (a[1] + c[1]) / 2;
        b.box(x, 5.2, z, len + 0.08, 0.3, 2.8, '#737b7e', { ry });
        b.box(x, 7.85, z, len + 0.08, 0.2, 2.95, '#aeb7b7', { ry });
        const nx = -dz / len, nz = dx / len;
        for (const side of [-1, 1]) {
            const off = side * 1.36;
            b.box(x + nx * off, 5.5, z + nz * off, len, 2.35, 0.08, '#4a6167', { ry, mat: 'g' });
            const n = Math.max(1, Math.ceil(len / 2.2));
            for (let j = 0; j <= n; j++) b.box(a[0] + dx * j / n + nx * off, 5.5, a[1] + dz * j / n + nz * off, 0.08, 2.35, 0.08, '#ccd2cf');
        }
        b.col(x, z, len / 2, 1.4, ry, { y0: 5.2, y1: 8.05, h: 8.05 });
    }
}

// Hotel Ambasador (1937-39, Arghir Culina) — interwar modernist stepped hotel on Bd. Magheru (~13 floors).
// Src: https://en.wikipedia.org/wiki/Hotel_Ambasador_(Bucharest)
export function bAmbasador(b) {
    // Independent Wikimedia façade photo (linked in the evidence record): two raised wings,
    // recessed central light well, cream piers and rounded balcony returns. All upper plates
    // are clipped to the mapped OSM footprint. Storey/setback dimensions are photo-led estimates.
    const [p] = P.ambasador.map(pts), S = '#e9e3d4', T = '#d8d1c0', GL = '#45566b';
    b.wall = S;
    const origin = [0.07, 10.045], ux = 0.95843, uz = -0.28532;
    const front = q => [(q[0] - origin[0]) * ux + (q[1] - origin[1]) * uz, -(q[0] - origin[0]) * uz + (q[1] - origin[1]) * ux];
    const local = q => [origin[0] + q[0] * ux - q[1] * uz, origin[1] + q[0] * uz + q[1] * ux];
    const clip = (x0, z0, x1, z1) => {
        let q = p.map(front);
        for (const [axis, edge, sign] of [[0,x0,1],[0,x1,-1],[1,z0,1],[1,z1,-1]]) {
            const out = [];
            for (let i = 0; i < q.length; i++) {
                const a = q[i], c = q[(i + 1) % q.length], ia = (a[axis] - edge) * sign >= 0, ic = (c[axis] - edge) * sign >= 0;
                if (ia) out.push(a);
                if (ia !== ic) { const t = (edge - a[axis]) / (c[axis] - a[axis]); out.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
            }
            q = out;
        }
        return q.map(local);
    };
    b.prism(p, 0, 7, S, { topCol: T });
    b.windows(p, 0.4, 6.7, 3.3, GL, { bay: 3.4, wf: 0.72, hf: 0.7, minL: 3, mat: 'g' });
    const blocks = [[clip(-60,-60,-4,0),7,30],[clip(4,-60,60,0),7,30],[clip(-4,-60,4,-12),7,40],
        [clip(-17,-60,-4,-2),30,40],[clip(4,-60,17,-2),30,40],
        [clip(-15.8,-60,-5.2,-3.2),40,43],[clip(5.2,-60,15.8,-3.2),40,43],
        [clip(-13.5,-60,-7.5,-4.5),43,46],[clip(7.5,-60,13.5,-4.5),43,46]];
    for (const [q,y0,y1] of blocks) {
        // (round 2, panorama 44.441899, 26.098971 heading 80, viewed at two zooms): every bay is a dark window over a
        // red-brown apron panel between pale piers; whole red squares read as polka dots from the boulevard
        b.prism(q,y0,y1,S,{topCol:T}); b.windows(q,y0+0.4,y1-1.8,3.3,'#9a7a6c',{bay:3.15,wf:0.7,hf:0.3,start:0.35,minL:2,off:0.06}); // (y1 − 1.8: same storey count as the glass row)
        b.windows(q,y0+0.4,y1-0.3,3.3,'#39424a',{bay:3.15,wf:0.7,hf:0.46,start:1.35,minL:2,off:0.06,mat:'g'});
        b.cornice(q,y1,0.35,0.2,T); b.colPolygon(q,{y0,y1});
    }
    // Rounded returns stay behind the surveyed street edge; no unsupported forward projection.
    for (const side of [-1,1]) for (let y=7;y<37;y+=3.3) {
        const line=[];
        for(let i=0;i<=8;i++){const a=i/8*Math.PI/2, q=local([side*(4+5*(1-Math.cos(a))),-7+5*Math.sin(a)]);line.push([q[0],y,q[1]]);}
        const lip=[local([side*4,-12]),...line.map(v=>[v[0],v[2]]),local([side*9,-12])];
        b.prism(lip,y,y+0.18,T); b.tube(line.map(v=>[v[0],v[1]+0.8,v[2]]),0.055,'#64564d',{seg:8,radial:3});
    }
    b.colPolygon(p,{y1:7});
}

// Blocul ARO / Patria (1931, Horia Creangă) — modernist, 10 levels (OSM way 163622261), ribbon
// windows, corner tower with the PATRIA cinema sign on Bd. Magheru.
// Src: https://ro.wikipedia.org/wiki/Blocul_ARO ; OSM way 163622261
export function bARO(b) {
    // (round 2, panoramas on Bd. Magheru at 44.442644, 26.098615 headings 105 / 120 and 44.442974, 26.098813 heading 149,
    // viewed only): a weathered grey-beige slab with continuous ribbon windows and pale sill bands over a shop floor, and a
    // taller, almost blind pale tower with one vertical glazed strip at the NORTH end. The model was white, had the tower
    // at the south end (the registry yaw of −175° turns model −z to the south) and carried a red PATRIA marquee and vertical
    // sign on the rear face; no such sign shows on the boulevard front in the panoramas, so none is drawn. OSM w163622261:
    // 10 levels (33 m at 3.3 m); the tower's extra height (to 43 m) is an estimate, it has no part of its own.
    const [p] = P.aro.map(pts), S = '#b4ad9f', LT = '#d3cdc0', GL = '#39424b';
    b.wall = S;
    b.prism(p, 0, 33, S, { topCol: '#8d8a84' });
    b.prism(offset(p, 0.08), 0, 3.7, '#353d44', { mat: 'g', top: false });
    b.cornice(p, 3.7, 0.45, 0.6, LT);
    b.bands(p, 4.2, 33, 3.3, GL, { frac: 0.44, start: 1.1, mat: 'g', wall: null });
    for (let y = 4.2 + 0.75; y + 0.35 < 33; y += 3.3) b.ring(offset(p, 0.2), y, y + 0.35, LT);            // pale sill bands
    const t = [[5.83, 21.97], [4.43, 29.3], [-13.59, 25.85], [-11.93, 17.21], [-2.85, 18.94]];             // the mapped north-end block
    b.prism(offset(t, 0.1), 0, 43, LT, { topCol: '#8d8a84' });
    { const a = t[0], c = t[1], n = edgeN(t, 0), at = k => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k]; facadeQuad(b, at(0.36), at(0.64), 5, 41.5, GL, 'g', n, 0.2); }   // glazed stair strip on the boulevard face
    b.colPolygon(p, { y1: 33 }); b.colPolygon(t, { y0: 33, y1: 43 });
}
