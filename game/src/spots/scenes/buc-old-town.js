// ============================================================================
//  Centrul Vechi (Bucharest Old Town): Strada Lipscani with Cărturești Carusel
//  (enterable: the white six-level atrium, 2015 refit of an 1860s bank),
//  Hanul lui Manuc (1808 caravanserai: whitewashed walls, dark timber eaves,
//  wooden galleries round the courtyard), the Curtea Veche ruins + Vlad Țepeș
//  bust + the 1559 church (spot `old-town-lipscani`); Stavropoleos church
//  (1724: carved porch with lobed arches, painted saint medallions, tiled
//  tower), Caru' cu Bere, CEC Palace and the National History Museum on Calea
//  Victoriei (spot `stavropoleos-cec`). Shared-surface cobbles, terraces with
//  awnings in front of every bar, cast-iron lanterns, shop signs from OSM.
//  No photo textures (no freedom of panorama in Romania): all modelled.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, M, hash2, headingFromBearing, centroid, polyBox, inPoly, distPolyline, canvas, canvasTexture, fitDraw, obb, polyArea } from '../kit.js';
import { bucStyle, bucBackdrop, classicFacade, classicWalls, balustradeMaterial, cityFiller, placeLandmark, signAtlas, oldTownTerraces, facadeToward, bucActivity } from '../buc.js';
import { sourceFacadeFrame } from '../source-facade.js';
import { buildSecretWcpBar } from './wcp-secret-bar.js';
import { createVenueActivities } from '../venue-activities.js';
import { collide } from '../walker.js';
import { candleLight } from '../candle-light.js';
import { photoHunt } from '../photo-hunt.js';
import { sourceRecord } from '../source-buildings.js';
import { buildOldTownNightlife, OLD_TOWN_FOCUS, nightlifeHours } from './old-town-nightlife.js';
import { walkBoundary, markVisitExits } from '../walk-boundary.js';
import {freddoFrontagePlan,oldTownGlazing} from './freddo-look.js';
import { buildOldTownDaylife } from './old-town-daylife.js';
import { poiSigns } from '../buc-streetscape.js';
import { caleaVictoriei, bnrLipscani, maccaPortal, maccaGlassRoof, withoutShopfront, courtyardSigns } from './ot-fronts.js';
import { osmBarriers } from '../buc-barriers.js';
import { grow, buildCarusel, buildManuc, buildCurteaVeche, buildStavropoleos, simplifyRing } from './old-town-landmarks.js';

// ---------------------------------------------------------------------------- the street fronts (notes 22 / 24)
// Lipscani, Gabroveni, Șelari, Covaci, Smârdan, Franceză & co.: 2–6-storey 19th-c. eclectic / neoclassical fronts on the OSM
// footprints. Tall shop ground floor (4.4 m) with timber / arched / modern shopfronts on every street side, a moulded string
// course, upper floors of 3.7 m with pilasters, pedimented / arched windows, stucco garlands, wrought-iron balconies (3-D on the
// street side), deep cornices and low zinc / tile roofs; pastel plasters, some restored and some peeling. All procedural.
const OT_NAMES = /Lipscani|Gabroveni|Șelari|Covaci|Smârdan|Franceză|Stavropoleos|Poștei|Șepcari|Sfântul Dumitru|Hanul cu Tei|Blănari|Băcani|Sf\. Gheorghe|Nicolae Șelari/;
const OT_COLS = ['#e9dfca', '#e6d3b3', '#ead9c6', '#d8c9a8', '#e3d6c3', '#cfd3c9', '#e7cfc0', '#d9c2a0', '#f0ebe0', '#c9c0b0', '#dcc9a6', '#e8e0d0', '#bfc6c4', '#d6b8a0', '#c7cbb8', '#e4c9b4'];
const OT_VARIANTS = [
    ['ot-a', [{ t: 'rect', w: 0.34, rail: true, pil: true, orn: true, top: 0.22 }, { t: 'pediment', w: 0.32, pil: true, top: 0.32 }, { t: 'arch', w: 0.3, pil: true, top: 0.3 }, { t: 'small', w: 0.26, dentils: true }], {}],
    ['ot-b', [{ t: 'arch', w: 0.36, pil: 'pair', rail: true, orn: true, top: 0.2 }, { t: 'arch', w: 0.34, pil: 'pair', top: 0.22 }, { t: 'rect', w: 0.3, pil: 'pair', top: 0.3 }, { t: 'small', w: 0.26, dentils: true }], {}],
    ['ot-c', [{ t: 'arch2', w: 0.4, rail: true, top: 0.14 }, { t: 'pediment', w: 0.34, orn: true, top: 0.32 }, { t: 'rect', w: 0.32, top: 0.3 }, { t: 'small', w: 0.28 }], { decay: 0.8 }],
    ['ot-d', [{ t: 'rect', w: 0.36, rail: true, top: 0.24 }, { t: 'rect', w: 0.34, top: 0.26 }, { t: 'rect', w: 0.34, top: 0.28 }, { t: 'small', w: 0.3 }], { decay: 1.4 }],
    ['ot-e', [{ t: 'arch', w: 0.34, rustic: true, rail: true, top: 0.2 }, { t: 'pediment', w: 0.32, pil: true, orn: true, top: 0.32 }, { t: 'arch', w: 0.3, pil: true, dentils: true, top: 0.3 }, { t: 'small', w: 0.26 }], {}],
    ['ot-f', [{ t: 'rect', w: 0.3, pil: 'pair', orn: true, rail: true, top: 0.24 }, { t: 'rect', w: 0.3, pil: 'pair', orn: true, top: 0.26 }, { t: 'arch', w: 0.3, pil: 'pair', top: 0.3 }, { t: 'blank' }], { decay: 0.5 }],
];
let IRON = null;
function ironRailMaterial() { // wrought-iron balcony railing: bars, a scroll band, top rail (alpha-tested)
    if (IRON) return IRON;
    const c = canvas(256, 128), x = c.getContext('2d'); x.clearRect(0, 0, 256, 128); x.strokeStyle = x.fillStyle = '#16181a';
    x.fillRect(0, 0, 256, 7); x.fillRect(0, 121, 256, 7); x.fillRect(0, 88, 256, 4);
    for (let i = 0; i < 16; i++) x.fillRect(i * 16 + 7, 0, 2.5, 128);
    x.lineWidth = 3; for (let i = 0; i < 8; i++) { const cx = i * 32 + 16; x.beginPath(); x.arc(cx - 6, 104, 7, 0, Math.PI * 1.6); x.stroke(); x.beginPath(); x.arc(cx + 6, 104, 7, Math.PI, Math.PI * 2.6); x.stroke(); }
    const t = canvasTexture(c, { repeat: true });
    IRON = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: '#ffffff' }); IRON.name = 'ot-iron'; IRON.userData.shared = true;
    return IRON;
}
function oldTownFronts(ctx, { exclude = [] } = {}) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch();
    const ways = d.ways.filter((w) => ['pedestrian', 'living_street', 'footway', 'residential'].includes(w.k) && OT_NAMES.test(w.name || ''));
    const exts = Object.values(d.spots).map((s) => s.extent.polygon);
    const nearWay = (x, z) => { let best = 1e9; for (const w of ways) { const q = distPolyline(x, z, w.pts); if (q.d < best) best = q.d; } return best; };
    const rails = new GeoBatch(), built = [];
    for (let bd of d.buildings) {
        if (bd.part || ctx.skipBuildings.has(bd.id) || /church|roof|kiosk|chapel/.test(bd.k || '') || (bd.h || 0) > 26) continue;
        const p = polyArea(bd.poly) > 0 ? bd.poly : [...bd.poly].reverse(), [cx, cz] = centroid(p);
        // Native source solids/parts/holes/roofs stay in the shared renderer.
        // These optional historic trim details never replace a building.
        if(bd.holes?.length || bd.hasParts) continue;
        if (!exts.some((e) => inPoly(cx, cz, e)) || exclude.some((e) => inPoly(cx, cz, e)) || Math.abs(polyArea(p)) < 25) continue;
        if (!p.some(([x, z]) => nearWay(x, z) < 8)) continue;
        const hs=hash2(cx*.37,cz*.53),record=sourceRecord(bd,0,g),gmax=record.datum,top=gmax+record.height;
        // (owner, 2026-11-11: "that balcony looks broken") Trim and balconies follow the facade actually drawn on this building
        // (decorated fronts are drawn 'eclectic'): its shop floor, storey height and window bays. They used an invented 4.4 m
        // ground floor, 3.7 m storeys and 3.4 m bays, so balconies stood between windows and under the sills.
        const F=sourceFacadeFrame(bd,record,{style:'eclectic'}),SF=F.S.floor,first=F.shop?F.upperBase:gmax+SF,GF=first-gmax;
        const lv=Math.max(1,Math.floor((top-first)/SF+1e-6)),light='#f2ede2';
        // Ornament sizes and balcony repetition are explicit visual estimates;
        // literal source mass/roof heights and every geometry member win.
        if(record.height>7)b.prism(grow(p,.12),gmax+GF-.12,gmax+GF+.08,light,'stone',{noTop:true});
        b.prism(grow(p,.18),top-.22,top,light,'stone',{noTop:true,bottom:true});
        // 3-D balconies with wrought-iron railings on the street side (first floor, where the façade row has a balconette)
        for (let i = 0; i < p.length; i++) {
            const [ax, az] = p[i], [bx, bz] = p[(i + 1) % p.length], L = Math.hypot(bx - ax, bz - az); if (L < 6.5) continue;
            const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (nearWay(mx, mz) > 9) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux; // outward normal (CCW polygon)
            // window bays exactly as drawn on this wall: n equal bays, a window centred in each
            const n = Math.max(1, Math.round(L / F.S.bay)), bw = L / n, span = n >= 3 && hash2(mx, mz) < 0.45 ? 3 : 1, c0 = Math.floor((n - span) / 2);
            for (const fl of lv >= 3 && hash2(mz, mx) < 0.5 ? [1, 2] : [1]) {
                if (fl === 2 && span === 3) continue;
                if (fl * SF > top - first + 1e-6) continue; // (the storey must exist on the drawn facade)
                const yb = first + (fl - 1) * SF + 0.05, u0 = (c0 + 0.12) * bw, u1 = (c0 + span - 0.12) * bw, w = u1 - u0, uc = (u0 + u1) / 2, D = 0.8;
                const px = ax + ux * uc + nx * D / 2, pz = az + uz * uc + nz * D / 2, yaw = Math.atan2(ux, uz);
                b.box(px + nx * 0.03, yb - 0.14, pz + nz * 0.03, D - 0.04, 0.16, w, light, 'stone', yaw);
                for (const k of [-0.42, 0.42]) b.box(ax + ux * (uc + k * w) + nx * 0.3, yb - 0.5, az + uz * (uc + k * w) + nz * 0.3, 0.45, 0.36, 0.14, light, 'stone', yaw);
                const P = (u, dd, y) => [ax + ux * u + nx * dd, y, az + uz * u + nz * dd];
                rails.quad(P(u0, D, yb), P(u1, D, yb), P(u1, D, yb + 1.0), P(u0, D, yb + 1.0), '#ffffff', 'iron', [0, 0, w / 1.6, 0, w / 1.6, 1, 0, 1]);
                for (const [uu, s] of [[u0, 1], [u1, -1]]) rails.quad(P(uu, 0.02, yb), P(uu, D, yb), P(uu, D, yb + 1.0), P(uu, 0.02, yb + 1.0), '#ffffff', 'iron', [0, 0, D / 1.6, 0, D / 1.6, 1, 0, 1]);
            }
        }
        built.push({ bd, p, inner: grow(p, -0.4), top, gmax, GF, lv });
    }
    ctx.add(b.build('old-town-facade-trim'));
    ctx.add(rails.build('old-town-balconies', { castShadow: true, matOverrides: { iron: ironRailMaterial() } }));
    return { built, ways, decoratedIds:new Set(built.map(x=>x.bd.id)) };
}

// ---------------------------------------------------------------------------- festoon string lights (note 25)
// Lipscani & co. are strung with festoons: warm bulbs on a black cable hung across the lane between wall brackets at a consistent
// height (≈ 5.6 m) with a gentle sag, lit at night. Every line ends on a façade bracket; no line is drawn without walls on both sides.
function rayFacade(blds, px, pz, dx, dz, maxD) {
    let best = null;
    for (const { p, bb } of blds) {
        if (Math.max(px, px + dx * maxD) < bb.x0 - 1 || Math.min(px, px + dx * maxD) > bb.x1 + 1 || Math.max(pz, pz + dz * maxD) < bb.z0 - 1 || Math.min(pz, pz + dz * maxD) > bb.z1 + 1) continue;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
            const [ax, az] = p[j], [bx, bz] = p[i], ex = bx - ax, ez = bz - az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) continue;
            const t = ((ax - px) * ez - (az - pz) * ex) / den, u = ((ax - px) * dz - (az - pz) * dx) / den;
            if (t > 0.5 && t < maxD && u >= 0 && u <= 1 && (!best || t < best.t)) best = { t, x: px + dx * t, z: pz + dz * t };
        }
    }
    return best;
}
function festoons(ctx, ways, { spacing = 5.5, height = 5.6 } = {}) {
    const d = ctx.data, g = ctx.ground, b = new GeoBatch(), bulbs = new GeoBatch(), out = [];
    const blds = d.buildings.filter((x) => !x.part).map((x) => ({ p: x.poly, bb: polyBox(x.poly) }));
    const bulbGeo = new THREE.OctahedronGeometry(0.05, 0);
    for (const w of ways) {
        if (!/Lipscani|Gabroveni|Șelari|Smârdan|Covaci|Franceză|Hanul cu Tei|Stavropoleos|Poștei|Blănari|Băcani/.test(w.name || '') || w.k === 'residential') continue;
        let acc = spacing * 0.5;
        for (let i = 1; i < w.pts.length; i++) {
            const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
            const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz, nz = ux;
            for (; acc < L; acc += spacing) {
                const cx = ax + ux * acc, cz = az + uz * acc;
                const A = rayFacade(blds, cx, cz, nx, nz, 11), B = rayFacade(blds, cx, cz, -nx, -nz, 11);
                if (!A || !B || A.t + B.t < 3.5 || A.t + B.t > 18) continue;
                const y = g.heightAt(cx, cz) + height, span = A.t + B.t, sag = 0.18 + span * 0.035;
                const pts = []; for (let q = 0; q <= 10; q++) { const t = q / 10; pts.push([A.x + (B.x - A.x) * t, y - Math.sin(t * Math.PI) * sag, A.z + (B.z - A.z) * t]); }
                for (let q = 1; q < pts.length; q++) b.rod(pts[q - 1], pts[q], 0.008, '#121212', 'metal', 3);
                for (const [P, s] of [[A, 1], [B, -1]]) { b.box(P.x - nx * s * 0.12, y - 0.05, P.z - nz * s * 0.12, 0.05, 0.08, 0.24, '#1a1a1a', 'metal', Math.atan2(nx, nz)); }
                const nb = Math.max(4, Math.round(span / 0.55));
                for (let q = 1; q < nb; q++) { const t = q / nb, x = A.x + (B.x - A.x) * t, z = A.z + (B.z - A.z) * t, yy = y - Math.sin(t * Math.PI) * sag - 0.09; bulbs.add(bulbGeo, 'bulb', M(x, yy, z, 0, 0, 0, 0.9, 1.25, 0.9), '#fff4d6'); b.cyl(x, yy + 0.04, z, 0.012, 0.05, '#121212', 'metal', 4); }
                out.push({ A, B, y });
            }
            acc -= L;
        }
    }
    const bm = new THREE.MeshStandardMaterial({ color: '#fff3d8', emissive: new THREE.Color('#ffc978'), emissiveIntensity: 0.15, roughness: 0.25 }); bm.name = 'festoon-bulbs'; bm.userData.dayGlow = 0.15; bm.userData.nightGlow = 3.2;
    ctx.add(b.build('festoon-cables', { castShadow: false }));
    ctx.add(bulbs.build('festoon-bulbs', { castShadow: false, matOverrides: { bulb: bm } }));
    return out;
}

export default {
    env: { fogFar: 3000, ambientCity: 0.65, groundAlbedo: 0.15 },
    async build(ctx) {
        const g = ctx.ground, d = ctx.data, spL = ctx.spot('old-town-lipscani'), spS = ctx.spot('stavropoleos-cec');
        // The Stavropoleos entry's own ground (data extent, from the research `walk_extent`) is Strada Stavropoleos from the
        // church to Caru' cu Bere (the part OLD_TOWN_FOCUS adds): tours, terraces and trim use it.
        // (r2) Live OSM, Overpass 2026-11-12 21:39 UTC, against the 2026-11-07 extract for Lipscani / Smardan / Selari / Covaci /
        // Franceza (236 named venues unchanged): one node deleted, three surveyed 2026-11-08/09 and two theatres mapped as
        // ways were missing. Applied here until the scene data is rebuilt; positions are the OSM node / way centres.
        { const ll = (lat, lon) => ({ x: +((lon - d.origin.lon) * d.projection.mLon).toFixed(1), z: +(-(lat - d.origin.lat) * d.projection.mLat).toFixed(1) });
          d.pois = d.pois.filter((q) => q.id !== 'n10775260921'); // "Dunk Shop", Lipscani: no longer in OSM
          for (const q of [
              { id: 'n14360710671', ...ll(44.4317174, 26.101947), amenity: 'ice_cream', name: 'Gelateria La Romania dal 1947' },
              { id: 'n14360710672', ...ll(44.4317146, 26.1020325), amenity: 'restaurant', cuisine: 'italian', name: 'Pizza al taglio', outdoor_seating: 'yes', 'addr:street': 'Strada Lipscani', 'addr:housenumber': '76' },
              { id: 'n14360710673', ...ll(44.4318253, 26.1022743), shop: 'shoes', name: 'Class shoes' },
              { id: 'w1471936597', ...ll(44.4321949, 26.1014776), amenity: 'theatre', name: 'Casa de Balet - Studio Unirii', 'addr:street': 'Strada Blănari', 'addr:housenumber': '21' },
              { id: 'w1472212055', ...ll(44.4319811, 26.1013285), amenity: 'theatre', name: 'Teatrul Zurli', 'addr:street': 'Strada Lipscani', 'addr:housenumber': '53' },
          ]) if (!d.pois.some((x) => x.id === q.id)) d.pois.push(q); }
        // A short visit at real scale: Lipscani 28–71 and upper Smârdan.
        // All prepared streets/buildings remain in the 600 m scenery context.
        const focused=(x,z)=>inPoly(x,z,OLD_TOWN_FOCUS), plaque=ctx.plaque.bind(ctx), challenge=ctx.challenge.bind(ctx);
        ctx.plaque=(p,x,z,...args)=>focused(x,z)?plaque(p,x,z,...args):null;
        ctx.challenge=(id,o={})=>{const sp=id==='old-town-lipscani'?spL:id==='stavropoleos-cec'?spS:null;return sp && focused(o.x??sp.photo.iconic.x,o.z??sp.photo.iconic.z)?challenge(id,o):null;};
        // a flat old town (bare-earth grid) — smooth the DEM noise
        const T0 = g.heightAt(0, 0); g.mod((x, z, h) => T0 + (h - T0) * 0.35);
        // most old-town buildings have no height in OSM: 2–5 storeys (uneven skyline), lantern-lit ground floors
        for (const bd of d.buildings) if (!bd.part && !bd.h && !bd.lv && bd.k !== 'church' && bd.k !== 'roof') { const hsh = Math.abs(Math.sin(bd.poly[0][0] * 12.9898 + bd.poly[0][1] * 78.233) * 43758.5453) % 1; bd.estimatedLevels = 2 + Math.floor(hsh * 4); }
        // (r3) the Macca-Vilacrosse block (r19924112, no height in OSM): three storeys over the Eugeniu Carada portal
        // (Street View 2022-10); an estimate like the rest, but no longer a random one that could cut the portal
        { const pb = d.buildings.find((x) => x.id === 'r19924112'); if (pb && !pb.h && !pb.lv) pb.estimatedLevels = 3; }
        // (fidelity pass r2, 2026-11-12) The National Bank block. Both palaces are pale limestone (Street View, Lipscani and
        // Doamnei); OSM gives them no colour and no height, so they were drawn as hash-coloured modern blocks 2-5 storeys
        // high. Colour and storey count here are estimates from the street views; every mapped part keeps its own height.
        const HERO_STONE = new Set();
        for (const [id, col, lv] of [['w1210146218', '#e2d8c2', 4], ['w1210147193', '#e6e0d2', 6]]) {
            const own = d.buildings.find((x) => x.id === id); if (!own) continue;
            own.estimatedLevels = lv;
            for (const bd of d.buildings) { if (bd !== own && !bd.part) continue; const [cx, cz] = centroid(bd.poly); if (bd === own || inPoly(cx, cz, own.poly)) { if (!bd.c && bd.mat !== 'brick') bd.c = col; HERO_STONE.add(bd.id); } }
        }
        // Ruinele Hanului Serban Voda (OSM node 6164079116, part way 658220780, no height): the excavated cellars lie under a
        // walk-on glass cover in the Lipscani paving in front of the bank; the bare part was extruded as a red three-storey box.
        { const ruin = d.buildings.find((x) => x.id === 'w658220780');
          if (ruin) { ctx.skipBuildings.add(ruin.id); const rb = new GeoBatch(), y = Math.max(...ruin.poly.map(([x, z]) => g.heightAt(x, z)));
            rb.prism(ruin.poly, y - 0.3, y + 0.1, '#8e8a82', 'stone', { noTop: true }); rb.flat(grow(ruin.poly, -0.25), y + 0.09, '#51666b', 'darkglass');
            const ro = obb(ruin.poly); for (let u = -ro.len / 2 + 1.4; u < ro.len / 2 - 0.5; u += 1.4) rb.box(ro.cx + ro.ux * u, y + 0.09, ro.cz + ro.uz * u, ro.wid - 0.5, 0.03, 0.06, '#3a3d3e', 'metal', Math.atan2(ro.ux, ro.uz));
            ctx.add(rb.build('serban-voda-ruins-glass', { castShadow: false })); } }
        const CA = buildCarusel(ctx), MA = buildManuc(ctx), CV = buildCurteaVeche(ctx), ST = buildStavropoleos(ctx);
        // CEC Palace + Post Palace (History Museum) from landmarks.js
        for (const [lmId, osmId] of [['cec', 'w973712798'], ['mnir', 'r19919941']]) { const bd = d.buildings.find((x) => x.id === osmId); if (!bd) continue; ctx.skipBuildings.add(osmId); const L2 = placeLandmark(ctx, lmId); for(const sourceId of L2?.lm.sourceIds||[])ctx.skipBuildings.add(sourceId);
            // r13104229 is one real relation with two prepared outer records.
            // Canonical CEC now includes both exact outer volumes and all holes.
            if(lmId==='cec')for(const sourceId of ['r13104229_0','r13104229_1'])ctx.skipBuildings.add(sourceId);
            // (round 4, r3-buc-spots-ot-cec) under this scene's sky light the CEC's warm source stone (#dccbaa / #e2d6bb) read
            // grey-beige; the 2023-08 panoramas show warm cream limestone. Its light stone vertices are warmed here (buildLandmark
            // builds a fresh geometry per call: the landmark model and the driving world keep theirs): red +4 %, green +1.5 %, blue −7 %
            // (pale stone stays above the 0.6 floor of the masonry joints shader).
            if(lmId==='cec'&&L2)L2.mesh.traverse((o)=>{const c=o.isMesh&&o.geometry?.attributes?.color;if(!c)return;const C=c;
                for(let i=0;i<C.count;i++){const r=C.getX(i),g=C.getY(i),b=C.getZ(i);if(r+g+b<1.7||r<b||r-b>0.3)continue;C.setXYZ(i,Math.min(1,r*1.04),Math.min(1,g*1.015),b>0.6?Math.max(0.605,b*0.93):b*0.93);}C.needsUpdate=true;});
            // placeLandmark supplies exact per-solid polygons/holes/vertical
            // bands. A second filled parent body would close real courtyards.
        }
        // Caru' cu Bere (Str. Stavropoleos 5): neo-Gothic front, sign, queue
        const caruB = d.buildings.find((x) => x.id === 'w1456401783');
        if (caruB) { ctx.skipBuildings.add(caruB.id); const b = new GeoBatch(), y = Math.min(...caruB.poly.map(([x, z]) => g.heightAt(x, z))) - 0.2; const fac = classicFacade('caru', [{ t: 'arch', w: 0.36, top: 0.1, bottom: 0.06, rustic: true }, { t: 'arch2', w: 0.34, pil: true }, { t: 'arch', w: 0.26, pil: true, top: 0.3 }, { t: 'small', w: 0.24 }], { bay: 3.2, floor: 4.2, lit: 0.85 }); classicWalls(b, fac, caruB.poly, y, y + 15.5, '#e4dccb', y); const o = obb(caruB.poly);
            // (r2) Street View from Str. Stavropoleos: a pale neo-Gothic stone front under a steep slate roof with a gabled centre
            // and a slim corner spire (it was a tan block with a flat roof). Roof rise and gable size are estimates.
            { const SL = '#474b50', ring = simplifyRing(caruB.poly, 1.5), top = grow(ring, -2.2), ye = y + 15.5, yr = y + 19.1;
              for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; b.quad([ring[i][0], ye, ring[i][1]], [ring[j][0], ye, ring[j][1]], [top[j][0], yr, top[j][1]], [top[i][0], yr, top[i][1]], SL, 'roofs'); b.quad([ring[j][0], ye, ring[j][1]], [ring[i][0], ye, ring[i][1]], [top[i][0], yr, top[i][1]], [top[j][0], yr, top[j][1]], SL, 'roofs'); }
              b.flat(top, yr, SL, 'roofs');
              b.box(-111, ye, -73.9, 5.2, 3.4, 2.6, '#e4dccb', 'stone'); b.add(new THREE.ConeGeometry(3.7, 2.6, 4), 'roofs', M(-111, ye + 3.4 + 1.3, -73.9, 0, Math.PI / 4, 0, 1, 1, 0.5), SL);
              b.cyl(-121.4, ye, -73.8, 1.1, 2.2, '#e4dccb', 'stone', 8); b.add(new THREE.ConeGeometry(1.35, 5.2, 8), 'roofs', M(-121.4, ye + 2.2 + 2.6, -73.8), SL); } ctx.poly(caruB.poly, { y0: y - 1, y1: y + 22 }); ctx.add(b.build('caru-cu-bere', { matOverrides: { [fac.key]: fac.mat } })); void o; }
        const OT = oldTownFronts(ctx);
        const FRONT=freddoFrontagePlan(ctx);ctx.extras.freddoFrontage=FRONT;
        // ground: shared-surface grey granite setts over every pedestrian street (no kerbs), slab bands
        ctx.terrainOpts = { bg: '#8f8b84', bgMask: 'cobble', innerPx: 2048, innerStep: 3, outerStep: 16, outerPad: 700 };
        // (r3) shopEvidence: false — every Old Town street front is a shop, bar or restaurant (Lipscani & co.): the
        // shopfront-needs-a-mapped-business rule of the other Bucharest scenes does not apply here.
        // (r3) The Old National Bank (w1210146218) has no shop floor: Street View 2022-10 from Lipscani shows a rusticated
        // ground floor with arched windows and the entrance stair (the every-front shop rule glazed it).
        // (round 4, r3-buc-spots-ot-4) Hanul cu Tei (r19931391): OSM building:levels=4, but the official 2022-10 panorama
        // from Lipscani shows a two-storey inn with deep timber eaves (the 1833 inn). Documented look exception: drawn with 2
        // levels (the data keeps OSM's 4); the eaves follow below. Eave depth and colour are estimates.
        const HCT = d.buildings.find((x) => x.id === 'r19931391'); if (HCT) HCT.lv = 2;
        withoutShopfront(ctx, ['w1210146218'], () => bucBackdrop(ctx, { shopEvidence: false, wallOpenings:FRONT?[FRONT.opening]:[],lampStyle: 'lantern', lampColor: '#191b1c', lampH: 4.4, lampPad: 15, treeLod: { cap: 1600, max: 400 }, lampOpts: { spacing: 24, kinds: ['pedestrian', 'living_street'] }, streetTreeOpts: { kinds: ['primary', 'secondary', 'tertiary'], prob: 0.5 }, style: (bd) => (OT.decoratedIds.has(bd.id) || bd.k === 'church' || HERO_STONE.has(bd.id) ? 'eclectic' : bucStyle(bd)) }));
        // (r3) Calea Victoriei at CEC / the History Museum, the Bank's Lipscani front, the Macca-Vilacrosse portal (ot-fronts.js)
        caleaVictoriei(ctx); bnrLipscani(ctx);
        // (round 4) the mapped walls, fences, hedges and plinths (osmBarriers); the CEC garden railing is ot-fronts' own
        osmBarriers(ctx, { skip: ['w657976539', 'w657976540'], pad: 60 });
        if (HCT) { const rec = sourceRecord(HCT, 0, g), top = rec.datum + rec.height, eb = new GeoBatch();
            for (const ring of [HCT.poly, ...(HCT.holes || [])]) for (let i = 0; i < ring.length; i++) { const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
                const yaw = Math.atan2(bx - ax, bz - az), k = (i % 3) * 0.04; eb.box((ax + bx) / 2, top - 0.45 - k, (az + bz) / 2, 2.0 + k * 1.5, 0.3, L + 0.9, '#4b3527', 'wood', yaw); } // under the roof edge; neighbours differ by 4 cm (no coplanar faces)
            ctx.add(eb.build('hanul-cu-tei-eaves')); ctx.extras.hanulCuTei = { levels: 2, osmLevels: 4, eaveTop: +top.toFixed(2) }; }
        { const pb = d.buildings.find((x) => x.id === 'r19924112'); if (pb) { const rec = sourceRecord(pb, 0, g); maccaPortal(ctx, { sourceTop: rec.datum + rec.height }); } }
        maccaGlassRoof(ctx, { recordOf: (bd) => { const r = sourceRecord(bd, 0, g); return r.datum + r.height; } });
        CA?.finishInterior();
        const WB = buildSecretWcpBar(ctx, CA);
        oldTownGlazing(ctx,FRONT);
        for (const w of d.ways) if (['pedestrian', 'living_street'].includes(w.k) && !w.tunnel) ctx.painter.line(w.pts, 11, '#7f7c76', 'cobble');
        // the inn passages (Hanul cu Tei, Pasajul Gabroveni, Intrarea Nicolae Șelari) are paved courtyards between the façades, not lawns
        for (const w of d.ways) if (w.k === 'footway' && /Hanul cu Tei|Pasajul Gabroveni|Nicolae Șelari/.test(w.name || '')) ctx.painter.line(w.pts, 18, '#86827b', 'cobble');
        ctx.extras.caruselFloor?.();
        { const lanes = d.ways.filter((w) => w.k === 'pedestrian' && /Lipscani|Șelari|Smârdan|Gabroveni|Franceză|Stavropoleos|Covaci|Poștei|Șepcari/.test(w.name || '')); const near = (t) => lanes.some((w) => { for (let i = 1; i < w.pts.length; i++) { const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, u = Math.max(0, Math.min(1, ((t.x - ax) * dx + (t.z - az) * dz) / L2)); if (Math.hypot(t.x - ax - dx * u, t.z - az - dz * u) < 7) return true; } return false; }); ctx.trees = ctx.trees.filter((t) => !near(t)); }
        ctx.painter.custom((x, T, k, isMask) => { if (isMask) return; for (const w of d.ways) { if (w.k !== 'pedestrian') continue; x.strokeStyle = 'rgba(205,200,190,0.55)'; x.lineWidth = Math.max(1, 0.9 * k); x.beginPath(); w.pts.forEach(([a, c], i) => { const [px, py] = T(a, c); if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); } });
        // terraces + shop signs from OSM (bars, restaurants, cafés, shops along the pedestrian lanes)
        const inside = (x, z) => Object.values(d.spots).some((s) => inPoly(x, z, s.extent.polygon));
        const TR = oldTownTerraces(ctx, { inside, seed: 3, prioritySources: ['n1416523788', 'n7613023091', 'n10775260925'],canopies:{n1416523788:{colour:'#30382f',glass:true}} });
        TR.signs=TR.signs.filter(s=>s.source!=='n1416523788');
        ctx.extras.sourceFrontages = { signs: TR.signs, terraces: TR.terraces };
        ctx.add(TR.group); ctx.lampPoints.push(...TR.lamps.filter((_, i) => i % 2 === 0));
        // Real OSM POIs, on their existing street-facing footprint. Camera-held props only:
        // no invented kiosk/interior, source footprint, terrace or collision changes.
        const VA = createVenueActivities(ctx);
        const NIGHTLIFE = buildOldTownNightlife(ctx, VA);
        for (const [source, kind, address, label] of [
            ['n1731040881', 'shaorma', 'Strada Franceză 17', 'Eat a shaorma at Dristor Kebap'],
            ['n10775253367', 'shot', 'Strada Șelari 17', 'Pour a shot at Shoteria'],
        ]) {
            const poi = d.pois.find(p => p.id === source); if (!poi) continue;
            let street = null;
            for (const w of d.ways) { if (!['pedestrian', 'living_street'].includes(w.k)) continue; const q = distPolyline(poi.x, poi.z, w.pts); if (!street || q.d < street.d) street = q; }
            const f = street && facadeToward(d, poi.x, poi.z, street.cx, street.cz); if (!f) continue;
            // Find the clear street approach beyond existing terrace collision, without
            // changing any footprint or moving its furniture. Both sources face Șelari.
            let approach = null;
            for (let distance = 5.2; distance <= 8; distance += .4) {
                const x = f.x + f.nx * distance, z = f.z + f.nz * distance;
                if (!collide(ctx.colliders, x, z, .45, g.heightAt(x, z) + .3)) { approach = { x, z }; break; }
            }
            if (!approach) continue;
            const { x, z } = approach;
            ctx.interactables.push({ x, z, y: g.heightAt(x, z), r: 2.6, label, source,
                cond: s => !VA.active && s.spot.id === 'old-town-lipscani',
                use: s => VA.start(s, kind, { name: poi.name, address }) });
        }
        const BUSKER = { x: 60, z: -66, crowd: [62, -62] };
        const signs = [...TR.signs];
        // (fidelity pass 2026-11-12) 37 of the 90 named venues mapped in the walk had no sign: the terrace pass only names
        // shops and places to eat, and drops a name when another sign already holds that stretch of wall. The clubs, hotels,
        // hostels, banks, museums, galleries and theatres of Lipscani / Smârdan now carry theirs too (second row where the
        // wall is taken). The five strip clubs / massage parlours stay unnamed on purpose; Freddo keeps its own front.
        { const have = new Set(TR.signs.map((s) => s.source));
            const X = poiSigns(ctx, { inside: focused, taken: TR.signs, max: 48, seed: 5, streets: d.ways.filter((w) => ['pedestrian', 'living_street'].includes(w.k) && !w.tunnel),
                accept: (p) => !have.has(p.id) && p.id !== 'n1416523788' && p.amenity !== 'stripclub' && (!!p.shop || ['restaurant', 'bar', 'cafe', 'pub', 'fast_food', 'ice_cream', 'nightclub', 'bank', 'theatre', 'arts_centre'].includes(p.amenity) || ['hotel', 'hostel', 'museum', 'gallery'].includes(p.tourism)) });
            signs.push(...X.signs); ctx.extras.extraVenueSigns = { signs: X.signs.map((s) => ({ source: s.source, text: s.text })), skipped: X.skipped }; }
        if (caruB) signs.push({ x: -111, y: g.heightAt(-111, -71.5) + 5.4, z: -71.4, yaw: 0, w: 6.2, h: 1.0, text: "CARU' CU BERE", bg: '#2a1d14', fg: '#e8c870', font: (q) => `700 ${q}px "Times New Roman", serif` });
        // Hanul cu Tei (Lipscani 63–65 → Blănari 14, 1833): the arched gateways of the inn's passage, painted lettering over the arch
        { const blds = d.buildings.filter((x) => !x.part).map((x) => ({ p: x.poly, bb: polyBox(x.poly) })), hb = new GeoBatch();
          for (const [px, pz, sz] of [[208.2, -56, -1], [212.8, -127, 1]]) {
            const A = rayFacade(blds, px, pz, 1, 0, 6), B = rayFacade(blds, px, pz, -1, 0, 6); if (!A || !B) continue;
            const y = g.heightAt(px, pz), x0 = B.x, x1 = A.x, w = x1 - x0, cxm = (x0 + x1) / 2, zf = pz + sz * 0.4, rr = w / 2 - 0.35;
            for (const xx of [x0 + 0.2, x1 - 0.2]) hb.box(xx, y - 0.2, zf, 0.7, 3.4, 0.9, '#efe6d2', 'stone');
            const arch = new THREE.TorusGeometry(rr, 0.32, 6, 16, Math.PI); hb.add(arch, 'stone', M(cxm, y + 3.2, zf), '#efe6d2'); arch.dispose();
            hb.box(cxm, y + 3.2 + rr, zf, w + 0.6, 1.5, 0.9, '#efe6d2', 'stone'); hb.box(cxm, y + 4.7 + rr, zf, w + 1.0, 0.25, 1.1, '#f6f1e6', 'stone');
            signs.push({ x: cxm, y: y + 3.95 + rr, z: zf + sz * 0.47, yaw: sz < 0 ? Math.PI : 0, w: Math.min(w + 0.2, 4.6), h: 0.62, text: 'HANUL CU TEI', bg: '#efe6d2', fg: '#3b2a1e', border: false, font: (q) => `700 ${q}px Georgia, serif` });
            ctx.lampPoints.push({ x: cxm, z: zf, h: 3.0, noPost: true });
          }
          ctx.add(hb.build('hanul-cu-tei')); }
        const SA = signAtlas(signs.slice(0, 128), { name: 'shop-signs' }); if (SA) ctx.add(SA);
        // (r2) The rest of the old town is seen from the walk (down Selari, Smardan and the passages) and had shopfronts
        // without a single name. Mapped, named venues on Lipscani west, Smardan south, Selari, Covaci, Franceza, Gabroveni
        // and Stavropoleos get a name board on their own building (OSM names only; no terraces or interiors are added).
        { const have = new Set(signs.map((q) => q.source)), outer = (x, z) => !focused(x, z) && x > -135 && x < 300 && z > -112 && z < 245;
          const O = poiSigns(ctx, { inside: outer, taken: signs, max: 110, seed: 9, streets: d.ways.filter((w) => ['pedestrian', 'living_street', 'residential', 'tertiary'].includes(w.k) && !w.tunnel && w.pts.length > 1),
              accept: (q) => !have.has(q.id) && q.amenity !== 'stripclub' && q.shop !== 'massage' && q.shop !== 'erotic' && (!!q.shop || ['restaurant', 'bar', 'cafe', 'pub', 'fast_food', 'ice_cream', 'nightclub', 'bank', 'theatre', 'arts_centre', 'pharmacy'].includes(q.amenity) || ['hotel', 'hostel', 'museum', 'gallery', 'guest_house'].includes(q.tourism)) });
          // (r3) Hanul cu Tei (r19931391): the passage is the inn's courtyard (a hole of the multipolygon), so the outer-wall
          // sign pass skipped the two mapped shops seen up the passage from Lipscani: Mom Art (n10775260927) and Cele Trei
          // Grații (n10775962190) now get their boards on the courtyard walls
          { const had = new Set([...have, ...O.signs.map((q) => q.source)]), ids = ['n10775260927', 'n10775962190'].filter((id) => !had.has(id));
            const CS = courtyardSigns(ctx, 'r19931391', ids, [...signs, ...O.signs]); O.signs.push(...CS); O.skipped.push(...ids.filter((id) => !CS.some((q) => q.source === id))); }
          const OA = signAtlas(O.signs, { name: 'shop-signs-outer' }); if (OA) ctx.add(OA);
          ctx.extras.outerVenueSigns = { signs: O.signs.map((q) => ({ source: q.source, text: q.text, x: q.x, z: q.z, yaw: q.yaw })), skipped: O.skipped }; }
        // festoon string lights strung between façade brackets (note 25: replaces the loose overhead cables)
        const FEST = festoons(ctx, OT.ways);
        // by day and beyond the club: a coffee, papanași, karaoke, the busker's case, a photo walk (old-town-daylife.js)
        buildOldTownDaylife(ctx, { focused, carusel: CA, busker: BUSKER, festoons: FEST, photoStart: NIGHTLIFE ? { x: NIGHTLIFE.entry.x + 5.5, z: NIGHTLIFE.entry.z + 4.5 } : null });
        cityFiller(ctx, { ring: 600 });
        // plaques
        const PL = spL.plaques, PS = spS.plaques, gy = (x, z) => g.heightAt(x, z);
        if (CA) { const f = CA.front; ctx.plaque(PL[5], f.x + f.nz * 9.5 + f.nx * 1.2, f.z - f.nx * 9.5 + f.nz * 1.2, f.yaw, { style: 'city', credit: '2015 refit: architects Square One (Ana Petrescu & Ramona Iliescu); the 1860s building restored by the Cărturești chain.' }); }
        // (r2) Both stood inside building footprints (108, -58 and 76, -40; the second 30 m from any street), so nobody
        // could walk up to them and the guided tour skipped them for the Carusel plaque 273 m away. They now stand on
        // Lipscani, at the nearest spot clear of walls and terraces.
        const freeNear = (x, z) => { for (let R = 0; R <= 6; R += 0.5) for (let a = 0; a < 8; a++) { const px = x + Math.cos(a * Math.PI / 4) * R, pz = z + Math.sin(a * Math.PI / 4) * R; if (focused(px, pz) && !collide(ctx.colliders, px, pz, 0.9, g.heightAt(px, pz) + 0.3)) return [px, pz]; } return [x, z]; };
        { const [ax, az] = freeNear(106, -61), [bx, bz] = freeNear(80, -66.5); ctx.plaque(PL[0], ax, az, Math.PI, { style: 'city' }); ctx.plaque(PL[1], bx, bz, Math.PI, { style: 'city' }); }
        if (MA) ctx.plaque(PL[2], MA.gate.x + MA.gn.x * 1.6 - MA.gn.z * 4.2, MA.gate.z + MA.gn.z * 1.6 + MA.gn.x * 4.2, Math.atan2(MA.gn.x, MA.gn.z), { style: 'city' });
        ctx.plaque(PL[3], CV.bust.x + 2.2, CV.bust.z - 1.6, Math.PI, { style: 'bronze' });
        if (CV.church) ctx.plaque(PL[4], CV.church.x - 14, CV.church.z - 4, -Math.PI / 2, { style: 'city' });
        if (ST) { ctx.plaque(PS[0], ST.west.x - 6.5, -64.5 + 3.5, Math.PI, { style: 'bronze' }); ctx.plaque(PS[1], ST.x + 9, -66.5, Math.PI, { style: 'bronze' }); }
        if (caruB) ctx.plaque(PS[2], -104, -67.5, Math.PI, { style: 'city' });
        ctx.plaque(PS[3], -212, -82, -Math.PI / 2, { style: 'city', credit: 'Architect Paul Gottereau (1897–1900).' });
        ctx.plaque(PS[4], -212, -32, -Math.PI / 2, { style: 'city', credit: 'Post Palace (1894–1900), architect Alexandru Săvulescu.' });
        // Public outdoor details require actual look/capture inputs. An exterior
        // source footprint does not establish present-day access to the ruins.
        if(CV.church){const ru=d.buildings.find(b=>b.id==='w658220894'),edge=ru?distPolyline(CV.bust.x+4,CV.bust.z+4,[...ru.poly,ru.poly[0]]):null;
            const targets=[{label:'Vlad III bust',x:CV.bust.x,y:gy(CV.bust.x,CV.bust.z)+2.65,z:CV.bust.z,radius:.4},
                {label:'Old Court church tower',...CV.church.tower,radius:1.6,surfaceTolerance:4}];
            if(edge)targets.push({label:'Old Court brick remains',x:edge.cx,y:CV.ruinsGround+1.2,z:edge.cz,radius:1.2});
            ctx.extras.curteaVecheVisit=photoHunt(ctx,{x:CV.bust.x+4,z:CV.bust.z+4,title:'Frame the Old Court details',targets,
                unavailable:'Explore these historic details from the public street. Current access inside the excavations has not been verified.',
                onDone:s=>bucActivity(s,'old-town-lipscani','curtea-veche','🏛 Old Court details framed','You framed the bust, church and mapped court remains from outside. This does not claim admission inside the excavations.')});}
        if (ST) {const candle=candleLight(ctx,new THREE.Vector3(),{title:'A virtual candle at Stavropoleos',portable:true,focus:new THREE.Vector3(ST.x,gy(ST.x,ST.z)+6,ST.z),
            onDone:s=>bucActivity(s,'stavropoleos-cec','stavropoleos','🕯 Candle practice completed','You lit and placed a temporary virtual candle in a handheld holder. This does not locate a real rack or imply current interior access.')});
            ctx.extras.stavropoleosCandle=candle;
            ctx.interactables.push({kind:'candle',x:ST.west.x-6.6,z:-66.4,r:2.4,label:'Light and place a virtual candle',use:s=>candle.start(s)});}
        if (CA) ctx.challenge('old-town-lipscani', { x: CA.ecx + (CA.front.x - CA.ecx) * 0.75, z: CA.ecz + (CA.front.z - CA.ecz) * 0.75, heading: (Math.atan2(CA.ecx - CA.front.x, -(CA.ecz - CA.front.z)) * 180 / Math.PI + 360) % 360, r: 6, tol: 40, text: 'Cărturești Carusel: the white atrium and its stacked balconies (best from the level-2 balcony)' });
        if (MA) ctx.challenge('old-town-lipscani', { x: MA.gate.x + MA.gn.x * 14, z: MA.gate.z + MA.gn.z * 14, heading: (Math.atan2(-MA.gn.x, MA.gn.z) * 180 / Math.PI + 360) % 360, r: 7, tol: 30, text: "Hanul lui Manuc's gate on Str. Franceză" });
        ctx.challenge('stavropoleos-cec', { view: ST ? [ST.x, ST.z] : null, r: 7, tol: 30 });
        // crowd: busy lanes, waiters at every terrace, a tour at Stavropoleos, the Caru' cu Bere queue
        const groups = [...WB.groups];
        // waiters at the terraces nearest the arrival points, turned toward their tables (talking, not standing stiff)
        const SP0 = { x: 128, z: -56.5 }, dist0 = (q) => Math.min(Math.hypot(q.x - SP0.x, q.z - SP0.z), Math.hypot(q.x + 92, q.z + 67.5));
        [...TR.terraces].sort((a, b) => dist0(a) - dist0(b)).slice(0, 16).forEach((t) => { groups.push({ x: t.x + Math.sin(t.yaw) * (t.depth / 2 + 0.5), z: t.z + Math.cos(t.yaw) * (t.depth / 2 + 0.5), r: 0.2, n: 1, act: 'talk', yaw: t.yaw + Math.PI, personas: ['waiter'] }); });
        // sitters: the terraces near the arrival points are busy (≈ 2 of 3 seats taken), one person per seat, facing the table
        // (the terrace in front of Freddo is the club's: its seats are taken only while the club is open, see the update below)
        const clubTerrace = (q) => FRONT && Math.hypot(q.x - FRONT.x, q.z - FRONT.z) < 10;
        [...TR.seats].sort((a, b) => dist0(a) - dist0(b)).slice(0, 130).forEach((q, i) => { if (i % 3 !== 2) groups.push({ x: q.x, z: q.z, r: 0.01, n: 1, act: 'sit', yaw: q.yaw, y: q.y, fixedYaw: true, club: clubTerrace(q), personas: ['local_young', 'tourist_uk', 'tourist_it', 'tourist_us', 'local_parent', 'local_elder'] }); });
        if (ST) groups.push({ x: ST.x + 4, z: -67.5, r: 2.6, n: 8, act: 'photo', look: [ST.x, ST.z], personas: ['tourist_de', 'tourist_fr', 'tourist_us'] }, { x: ST.x + 8.5, z: -66.5, r: 0.3, n: 1, act: 'guide', look: [ST.x + 4, -67.5], personas: ['tour_guide'] });
        if (caruB) groups.push({ line: [[-111, -70.2], [-105, -69.6], [-99, -69.2], [-93, -68.8]], n: 9, act: 'queue', personas: ['tourist_de', 'tourist_us', 'local_young', 'tourist_fr', 'tourist_uk'] });
        if (CA) groups.push({ x: CA.front.x + CA.front.nx * 4, z: CA.front.z + CA.front.nz * 4, r: 2.5, n: 5, act: 'photo', look: [CA.front.x, CA.front.z], personas: ['tourist_it', 'tourist_us', 'local_young'] }, { x: CA.ecx, z: CA.ecz, r: 3, n: 5, act: 'watch', personas: ['local_young', 'tourist_uk', 'tourist_fr'] });
        groups.push({ x: CV.bust.x - 3, z: CV.bust.z - 3.5, r: 0.3, n: 1, act: 'watch', personas: ['vendor'] }, { x: CV.bust.x + 2, z: CV.bust.z - 4, r: 2, n: 4, act: 'photo', look: [CV.bust.x, CV.bust.z], personas: ['tourist_uk', 'tourist_it', 'tourist_us'] });
        groups.push({ x: BUSKER.x, z: BUSKER.z, r: 0.3, n: 1, act: 'perform', personas: ['busker'], prop: 'guitar' }, { x: BUSKER.crowd[0], z: BUSKER.crowd[1], r: 2.5, n: 4, act: 'watch', look: [BUSKER.x, BUSKER.z], personas: ['local_young', 'tourist_uk'] });
        if (MA) groups.push({ x: MA.gate.x + MA.gn.x * 2.5 + MA.gn.z * 2.6, z: MA.gate.z + MA.gn.z * 2.5 - MA.gn.x * 2.6, r: 0.3, n: 1, act: 'watch', yaw: Math.atan2(MA.gn.x, MA.gn.z), personas: ['waiter'] });
        // Keep the native street crowd concentrated on the selected source ways.
        // Path points are unscaled source points; splitting the walking itinerary
        // does not alter or delete a road in the prepared dataset.
        const paths=[];
        for(const way of d.ways.filter(w=>['pedestrian','footway','living_street'].includes(w.k))){let run=[];for(const p of way.pts){if(focused(...p))run.push(p);else{if(run.length>1)paths.push(run);run=[];}}if(run.length>1)paths.push(run);}
        const party=[];
        for(const path of paths)for(let i=1;i<path.length;i++){const [ax,az]=path[i-1],[bx,bz]=path[i],L=Math.hypot(bx-ax,bz-az);if(L<1)continue;
            for(let u=1;u<L;u+=4.5)for(const side of [-1,1]){const x=ax+(bx-ax)*u/L+(bz-az)/L*side*2.1,z=az+(bz-az)*u/L-(bx-ax)/L*side*2.1;
                if(party.length>=64||!focused(x,z)||collide(ctx.colliders,x,z,.45,g.heightAt(x,z)+.3)||party.some(p=>Math.hypot(p.x-x,p.z-z)<1.1)||NIGHTLIFE&&Math.hypot(x-NIGHTLIFE.entry.x,z-NIGHTLIFE.entry.z)<2.2)continue;
                party.push({x,z,r:0,n:1,act:'talk',party:true,fixedYaw:true,personas:['local_young','tourist_uk','tourist_it','tourist_us']});}}
        ctx.crowdCfg = {
            spots: ['old-town-lipscani', 'stavropoleos-cec'],
            personas: { local_young: 4, tourist_uk: 2.5, tourist_it: 1.8, tourist_us: 1.8, tourist_de: 1.5, tourist_fr: 1.2, local_elder: 1, local_parent: 2.2, kid: 1.6 }, // (families walking: more parents and children)
            walkers: 92, paths, groups:groups.filter(q=>q.wcpFan||focused(q.x??q.line?.[0]?.[0],q.z??q.line?.[0]?.[1])).concat(party),
        };
        let partyPeople=null;
        let clubSitters=null;
        ctx.onUpdate((dt,s)=>{if(!partyPeople&&s.spot.crowd?.cr)partyPeople=s.spot.crowd.peds.map((p,i)=>({p,i})).filter(({p})=>p.group?.party);
            if(!clubSitters&&s.spot.crowd?.peds)clubSitters=s.spot.crowd.peds.filter(p=>p.group?.club);
            const night=nightlifeHours(s.spot.crowd.cond?.hour??12).party;
            if(clubSitters)for(const p of clubSitters)p.hidden=!nightlifeHours(s.spot.crowd.cond?.hour??12).open;
            // the 64 people standing out in the lanes are the club night's crowd: by day they are not there
            if(partyPeople)for(const {p} of partyPeople)p.hidden=!night;
            if(!partyPeople||!night)return;
            for(const {p,i} of partyPeople){const phase=s.t*Math.PI*2.1+p.phase;s.spot.crowd.cr.set(i,{x:p.x,y:p.y+Math.max(0,Math.sin(phase))*.035,z:p.z,yaw:p.yaw+Math.sin(phase*.5)*.16,phase,scale:p.look.scale,amp:.45,pose:i%3?'talk':'cheer',prop:null});}});
        ctx.interactables=ctx.interactables.filter(it=>it.hidden||focused(it.x,it.z)||it.x>7000);
        // ambience
        ctx.sound('crowd', 120, -60, 60, 1); ctx.sound('crowd', 200, 120, 50, 0.8); ctx.sound('crowd', -60, -66, 40, 0.6);
        ctx.sound('bell', CV.church?.x ?? 205, CV.church?.z ?? 134, 260, 0.45); ctx.sound('traffic', -240, -60, 120, 0.7); ctx.sound('traffic', 300, 0, 120, 0.5);
        // spawns
        ctx.spawns['old-town-lipscani'] = NIGHTLIFE ? { x:NIGHTLIFE.entry.x+3,z:NIGHTLIFE.entry.z+2.5,heading:headingFromBearing(300) } : { x:128,z:-56.5,heading:headingFromBearing(78) };
        // (r2) The Stavropoleos entry arrives on Strada Stavropoleos between Caru' cu Bere and the church (it shared the
        // Smardan arrival, 300 m away: its guided tour could not reach the church, the candle or its postcard).
        ctx.spawns['stavropoleos-cec'] = ST ? { x: -84, z: -66.5, heading: headingFromBearing(100) } : { ...ctx.spawns['old-town-lipscani'] };
        ctx.extras.walkBoundary=walkBoundary(()=>[OLD_TOWN_FOCUS,
            ...(NIGHTLIFE?.room.visible?[NIGHTLIFE.polygon]:[]),
            ...(ctx.extras.wcpRoom?.room.visible?[[[7994.2,7999.5],[8005.8,7999.5],[8005.8,8011],[7994.2,8011]]]:[])]);
        ctx.extras.visitExits=markVisitExits(ctx,OLD_TOWN_FOCUS);
        void balustradeMaterial; void fitDraw;
    },
};
