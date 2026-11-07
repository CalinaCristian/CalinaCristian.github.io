import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture, makeRng } from './util.js';
import { MeshBuilder, rgb, shadeRgb, prep } from './geobuild.js';
import { BUILDING_SPECS } from './buildings.js';

// ============================================================================
//  ARCHETYPES (round 5, owner note 77) — every non-residential building in the districts modelled after what it really
//  is: curtain-wall and punched-window offices, hotels, malls and retail boxes, supermarkets, parking garages, industrial
//  sheds, schools / universities / clinics / civic blocks, US storefront rows, bank / drive-thru pads.
//
//  Input: the per-building research specs (game/research/buildings-<city>-<district>.json, baked into buildings.js
//  BUILDING_SPECS: archetype, storeys, ground-floor height, facade colour / material / era, roof, shop units, name,
//  street it fronts) matched to the district footprints by position, + OSM `building` type (data.buildingInfo) for
//  footprints the research did not cover. Hand-modelled landmarks / CV stops are skipped (b.skip / b.cv), fuel
//  stations are world-visual's.
//
//  Output (world.js "extrude buildings" calls emit() per building):
//   - walls in a dedicated 16-tile facade atlas (archetypeAtlas) drawn with the city's facade shader
//     (world.js solidMaterial(atlas): lit windows / rooms, curtain-wall reflections on tiles 4 / 12, shop glazing lit at
//     night on 6 / 14), one merged mesh per 500 m super-cell → +1 draw call per super-cell;
//   - canopies, portals, fins, parapets, loading docks, roller doors, plant screens, trolley shelters … into the
//     city's own cell builders (solid = far, detail = near LOD, roof = snow-tinted roofs). No new draw calls.
//  Buildings that stay in the city's residential pipeline (RO shopfront rows, mixed-use blocks, villas used as offices)
//  get the researched ground-floor height, storeys, colour and shopfronts on the street faces only (b.gfh, b.shopFaces).
//  Brand / building names only from OSM / research text (never invented).
// ============================================================================

// ---- atlas layout (same 4 × 4 layout and tile semantics as the city atlas: 4 / 12 curtain wall, 6 / 14 shop glazing)
export const AT = { office: 0, stone: 1, school: 2, precast: 3, cw: 4, panel: 5, front: 6, corr: 7, brick: 8, inst: 9, hotel: 10, works: 11, cw2: 12, park: 13, store: 14, sandwich: 15 };
// metres covered by one tile: [width, height] (height in storeys when `fl` is true)
const TM = {
    0: [6.2, 2, true], 1: [7.2, 2, true], 2: [7.4, 2, true], 3: [9.0, 2, true], 4: [6.0, 2, true], 5: [6.0, 3.0], 6: [12.0, 1, true],
    7: [2.4, 6.0], 8: [9.6, 2, true], 9: [10.2, 2, true], 10: [10.2, 2, true], 11: [9.0, 1, true], 12: [3.0, 4, true], 13: [16.0, 1, true], 14: [20.0, 1, true], 15: [6.0, 4.0],
};

/** the archetype facade atlas (1024²: 16 tiles of 256 px), colours near white where the vertex colour should tint */
export function archetypeAtlas() {
    const S = 256;
    const tex = makeCanvasTexture(4 * S, 4 * S, (ctx) => {
        const R = makeRng(7177);
        const at = (k) => [(k % 4) * S, (3 - Math.floor(k / 4)) * S]; // flipY: uv row r → canvas row 3 - r
        const g = (v) => `rgb(${v},${v},${v})`;
        const fill = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
        const speckle = (x, y, w, h, n, a, sz = 3) => { for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * a})`; ctx.fillRect(x + R() * w, y + R() * h, 1 + R() * sz, 1 + R() * sz); } };
        // window glass (dark blue-grey, as the night / window masks expect: lum < 150 and b ≥ r + 4), sky reflection on top
        const glass = (x, y, w, h, c0 = [38, 54, 76], c1 = [62, 82, 106]) => {
            const gr = ctx.createLinearGradient(x, y, x + w * 0.3, y + h); gr.addColorStop(0, `rgb(${c1})`); gr.addColorStop(1, `rgb(${c0})`);
            ctx.fillStyle = gr; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
        };
        const frameWin = (x, y, w, h, { frame = 'rgb(66,64,62)', fw = 3, mull = 0, trans = 0, c0, c1 } = {}) => {
            fill(frame, x - fw, y - fw, w + fw * 2, h + fw * 2);
            const cols = mull + 1, rows = trans + 1, pw = (w - mull * fw) / cols, ph = (h - trans * fw) / rows;
            for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) glass(x + i * (pw + fw), y + j * (ph + fw), pw, ph, c0, c1);
        };

        // 0 office: 1990s–2000s office block — precast spandrel bands, continuous window band, mullions every half bay
        { const [x, y] = at(0); fill(g(236), x, y, S, S); speckle(x, y, S, S, 500, 0.04);
            for (let f = 0; f < 2; f++) {
                const fy = y + f * 128;
                fill('rgb(70,72,76)', x, fy + 10, S, 82); // window band frame
                for (let p = 0; p < 4; p++) glass(x + p * 64 + 4, fy + 14, 56, 74);
                fill('rgba(0,0,0,0.18)', x, fy + 92, S, 4); // sill shadow
                fill('rgba(255,255,255,0.5)', x, fy + 96, S, 2);
                fill('rgba(0,0,0,0.07)', x + 127, fy + 96, 2, 32); // panel joints
            } }
        // 1 stone: stone / travertine cladding, tall narrow windows (banks, ministries, post-war civic)
        { const [x, y] = at(1); fill(g(232), x, y, S, S);
            for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) { fill(g(226 + Math.floor(R() * 16)), x + i * 64 + 1, y + j * 32 + 1, 62, 30); }
            speckle(x, y, S, S, 900, 0.05, 2);
            for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) frameWin(x + i * 85.3 + 28, y + f * 128 + 18, 29, 92, { fw: 3, trans: 1, frame: 'rgb(84,80,74)' });
        }
        // 2 school: socialist-era classroom block — wide three-light windows with fanlights, plaster bands
        { const [x, y] = at(2); fill(g(242), x, y, S, S); speckle(x, y, S, S, 400, 0.04);
            for (let f = 0; f < 2; f++) {
                const fy = y + f * 128; fill('rgba(0,0,0,0.05)', x, fy + 96, S, 32);
                for (let i = 0; i < 2; i++) frameWin(x + i * 128 + 14, fy + 18, 100, 70, { fw: 4, mull: 2, trans: 1, frame: 'rgb(246,246,244)', c0: [40, 56, 78], c1: [70, 90, 112] });
                for (let i = 0; i < 2; i++) fill('rgba(0,0,0,0.16)', x + i * 128 + 8, fy + 94, 112, 4);
            } }
        // 3 precast: socialist concrete frame grid, recessed windows with deep reveals
        { const [x, y] = at(3); fill(g(214), x, y, S, S); speckle(x, y, S, S, 1400, 0.07, 2);
            for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) {
                const wx = x + i * 85.3 + 9, wy = y + f * 128 + 14;
                fill('rgb(108,104,98)', wx, wy, 67, 80); // reveal
                frameWin(wx + 6, wy + 8, 55, 66, { fw: 2, mull: 1, frame: 'rgb(92,88,84)' });
                fill('rgba(0,0,0,0.22)', wx, wy, 67, 6);
            }
            for (let f = 0; f < 2; f++) fill('rgba(0,0,0,0.10)', x, y + f * 128 + 104, S, 3);
            for (let i = 0; i <= 3; i++) fill('rgba(255,255,255,0.18)', x + i * 85.3 - 2, y, 4, S);
        }
        // 4 curtain wall: 4 modules × 2 storeys; vision glass + opaque spandrel band, aluminium mullions / transoms
        { const [x, y] = at(4); fill('rgb(160,174,188)', x, y, S, S);
            for (let f = 0; f < 2; f++) {
                const fy = y + f * 128;
                for (let m = 0; m < 4; m++) {
                    const gr = ctx.createLinearGradient(x + m * 64, fy, x + m * 64 + 30, fy + 96);
                    gr.addColorStop(0, 'rgb(186,198,210)'); gr.addColorStop(1, 'rgb(146,160,176)');
                    ctx.fillStyle = gr; ctx.fillRect(x + m * 64, fy, 64, 98);
                    fill('rgb(100,110,122)', x + m * 64, fy + 98, 64, 30); // spandrel
                }
                fill('rgb(222,226,230)', x, fy + 96, S, 4); fill('rgb(210,214,218)', x, fy + 126, S, 2);
            }
            for (let m = 0; m <= 4; m++) fill('rgb(226,230,234)', x + m * 64 - 2, y, 4, S);
        }
        // 5 panel: blank metal / composite cladding (malls, retail boxes): large panels, fine joints
        { const [x, y] = at(5); fill(g(236), x, y, S, S);
            for (let j = 0; j < 4; j++) for (let i = 0; i < 2; i++) fill(g(230 + Math.floor(R() * 14)), x + i * 128 + 1, y + j * 64 + 1, 126, 62);
            for (let j = 0; j <= 4; j++) fill('rgba(0,0,0,0.22)', x, y + j * 64 - 1, S, 2);
            for (let i = 0; i <= 2; i++) fill('rgba(0,0,0,0.22)', x + i * 128 - 1, y, 2, S);
            speckle(x, y, S, S, 300, 0.03);
        }
        // 6 front: aluminium-framed glazing (supermarket / mall fronts, office lobbies): 4 units, dark fascia, transom
        { const [x, y] = at(6); fill('rgb(46,48,52)', x, y, S, S);
            for (let u = 0; u < 4; u++) {
                const ux = x + u * 64;
                fill('rgb(30,32,36)', ux, y, 64, 34); // fascia (dark: not lit as a sign band)
                const gr = ctx.createLinearGradient(ux, y + 38, ux + 20, y + 238); gr.addColorStop(0, 'rgb(150,176,200)'); gr.addColorStop(0.45, 'rgb(104,134,164)'); gr.addColorStop(1, 'rgb(84,112,140)');
                ctx.fillStyle = gr; ctx.fillRect(ux + 4, y + 38, 56, 200);
                fill('rgb(46,48,52)', ux + 4, y + 84, 56, 4); // transom
                fill('rgb(46,48,52)', ux + 31, y + 88, 2, 150); // mullion
                fill('rgba(255,255,255,0.12)', ux + 8, y + 92, 10, 140);
                fill('rgb(58,60,64)', ux, y + 238, 64, 18); // bulkhead
            } }
        // 7 corrugated metal (sheds, warehouses): vertical trapezoidal ribs every 0.3 m, lap line
        { const [x, y] = at(7); fill(g(226), x, y, S, S);
            for (let i = 0; i < 8; i++) { const rx = x + i * 32; fill(g(244), rx, y, 7, S); fill(g(206), rx + 7, y, 3, S); fill(g(224), rx + 10, y, 18, S); fill(g(196), rx + 28, y, 4, S); }
            fill('rgba(0,0,0,0.2)', x, y, S, 3); speckle(x, y, S, S, 250, 0.04);
        }
        // 8 brick (US institutional / office / hotel low-rise): brick courses, stone lintels + sills, punched windows
        { const [x, y] = at(8); fill(g(176), x, y, S, S);
            for (let j = 0; j < 64; j++) { fill('rgba(0,0,0,0.10)', x, y + j * 4, S, 1); for (let i = 0; i < 24; i++) fill(`rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.07})`, x + i * 11 + (j % 2) * 5, y + j * 4 + 1, 10, 3); }
            for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) {
                const wx = x + i * 85.3 + 21, wy = y + f * 128 + 24;
                fill(g(250), wx - 5, wy - 9, 53, 7); fill(g(244), wx - 3, wy + 74, 49, 5);
                frameWin(wx, wy, 43, 70, { fw: 3, trans: 1, frame: 'rgb(58,56,54)' });
            } }
        // 9 interwar institution (schools, hospitals, ministries 1920–40): tall gridded windows, plinth line, bands
        { const [x, y] = at(9); fill(g(240), x, y, S, S); speckle(x, y, S, S, 500, 0.05);
            for (let f = 0; f < 2; f++) {
                fill('rgba(0,0,0,0.09)', x, y + f * 128 + 120, S, 5);
                for (let i = 0; i < 3; i++) frameWin(x + i * 85.3 + 22, y + f * 128 + 14, 41, 92, { fw: 3, mull: 1, trans: 2, frame: 'rgb(250,250,248)' });
            } }
        // 10 hotel: regular room-window grid, accent panel under each window (vertical rhythm)
        { const [x, y] = at(10); fill(g(242), x, y, S, S); speckle(x, y, S, S, 300, 0.03);
            for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) {
                const wx = x + i * 85.3 + 18, wy = y + f * 128 + 18;
                fill(g(212), wx - 4, wy + 76, 57, 28); // accent spandrel
                frameWin(wx, wy, 49, 72, { fw: 3, mull: 1, frame: 'rgb(78,78,80)' });
            } }
        // 11 old works (RO industrial / workshops): plaster with large steel-framed multi-pane windows
        { const [x, y] = at(11); fill(g(232), x, y, S, S); speckle(x, y, S, S, 900, 0.07);
            for (let i = 0; i < 2; i++) {
                const wx = x + i * 128 + 16, wy = y + 46;
                fill('rgb(72,70,68)', wx - 4, wy - 4, 104, 150);
                for (let a = 0; a < 4; a++) for (let b2 = 0; b2 < 5; b2++) glass(wx + a * 24 + 1, wy + b2 * 28 + 1, 22, 26, [44, 58, 74], [70, 86, 102]);
            }
            fill('rgba(0,0,0,0.12)', x, y + 236, S, 20);
        }
        // 12 curtain wall, unitised (towers): 2 modules × 4 storeys, thin spandrels, intermediate mullion
        { const [x, y] = at(12); fill('rgb(150,166,176)', x, y, S, S);
            for (let f = 0; f < 4; f++) {
                const fy = y + f * 64;
                for (let m = 0; m < 2; m++) {
                    const gr = ctx.createLinearGradient(x + m * 128, fy, x + m * 128 + 60, fy + 52);
                    gr.addColorStop(0, 'rgb(176,192,202)'); gr.addColorStop(1, 'rgb(138,156,168)');
                    ctx.fillStyle = gr; ctx.fillRect(x + m * 128, fy, 128, 52);
                    fill('rgb(108,118,128)', x + m * 128, fy + 52, 128, 12);
                    fill('rgb(214,218,222)', x + m * 128 + 63, fy, 2, 52);
                }
                fill('rgb(220,224,228)', x, fy + 50, S, 3);
            }
            for (let m = 0; m <= 2; m++) fill('rgb(226,230,234)', x + m * 128 - 2, y, 4, S);
        }
        // 13 parking deck: slab edge, open level (dark, not glass: no rooms / lit windows), columns, parapet
        { const [x, y] = at(13); fill(g(222), x, y, S, S); speckle(x, y, S, S, 700, 0.06, 2);
            const oy = y + 26, oh = 134; // opening (v 0.37–0.9 of the level)
            const gr = ctx.createLinearGradient(x, oy, x, oy + oh); gr.addColorStop(0, 'rgb(84,80,76)'); gr.addColorStop(0.3, 'rgb(52,50,48)'); gr.addColorStop(1, 'rgb(40,39,38)');
            ctx.fillStyle = gr; ctx.fillRect(x, oy, S, oh);
            for (let k = 0; k < 5; k++) { const cx = x + 10 + k * 50 + R() * 10, cw = 34 + R() * 6; fill('rgb(30,29,29)', cx, oy + oh - 30, cw, 30); fill('rgb(34,33,32)', cx + 7, oy + oh - 42, cw - 14, 14); }
            fill('rgb(70,68,66)', x, oy, S, 6); // ceiling shadow line
            for (let i = 0; i <= 2; i++) fill(g(214), x + i * 128 - 9, oy, 18, oh);
            fill(g(206), x, y, S, 26); fill('rgba(0,0,0,0.18)', x, oy + oh, S, 4); // slab edge + drip line
            fill('rgba(0,0,0,0.08)', x, y + 206, S, 2);
        }
        // 14 storefront with piers (US retail rows, RO shop arcades): 4 units, stone piers, transom, bulkhead
        { const [x, y] = at(14); fill('rgb(214,206,192)', x, y, S, S);
            for (let u = 0; u < 4; u++) {
                const ux = x + u * 64;
                fill('rgb(36,38,42)', ux + 8, y + 6, 48, 30); // sign band (dark: brand signs are geometry)
                const gr = ctx.createLinearGradient(ux, y + 40, ux + 16, y + 234); gr.addColorStop(0, 'rgb(156,180,204)'); gr.addColorStop(0.5, 'rgb(106,136,166)'); gr.addColorStop(1, 'rgb(88,114,142)');
                ctx.fillStyle = gr; ctx.fillRect(ux + 10, y + 40, 44, 196);
                fill('rgb(52,52,54)', ux + 10, y + 78, 44, 4); fill('rgb(52,52,54)', ux + 31, y + 82, 2, 154);
                fill('rgb(120,86,70)', ux + 8, y + 236, 48, 20); // bulkhead
                fill('rgba(0,0,0,0.12)', ux + 6, y, 2, S); fill('rgba(0,0,0,0.12)', ux + 56, y, 2, S);
            } }
        // 15 sandwich panels / louvres: horizontal insulated panels 1 m (sheds, big boxes, plant screens)
        { const [x, y] = at(15); fill(g(238), x, y, S, S);
            for (let j = 0; j < 4; j++) { const gr = ctx.createLinearGradient(x, y + j * 64, x, y + j * 64 + 64); gr.addColorStop(0, 'rgb(246,246,246)'); gr.addColorStop(1, 'rgb(222,222,222)'); ctx.fillStyle = gr; ctx.fillRect(x, y + j * 64 + 2, S, 60); fill('rgba(0,0,0,0.3)', x, y + j * 64, S, 2); }
            speckle(x, y, S, S, 200, 0.03);
        }
    });
    tex.anisotropy = 8;
    return tex;
}

// ---- research table → spec records
const CODE = { sr: 'shopfront-row', mx: 'mixed-use', ob: 'office block', cv: 'civic', cw: 'curtain-wall office', ho: 'hotel', un: 'university', ch: 'church', in: 'industrial shed', sc: 'school', fu: 'fuel station', su: 'supermarket box', pk: 'parking structure', ml: 'mall', bk: 'bank front', dt: 'drive-thru', cvs: 'CV stop' };
const specOf = (r) => ({ lat: r[0], lon: r[1], m2: r[2], a: r[3], st: r[4], gfh: r[5], hex: r[6], flags: r[7], mat: r[8], style: r[9], roof: r[10], units: r[11], name: r[12], fronts: r[13], year: r[14], sign: r[15] });

const RE = {
    hotel: /\bhotel|hostel|ramada|ibis\b|marriott|courtyard|hilton|hyatt|westin|novotel|radisson|vienna house|best western|motel|\binn\b|suites\b/i,
    clinic: /spital|clinic|medicover|regina maria|policlinic|hospital|sanador|medlife|centrul medical|medical center|maternitat/i,
    school: /liceul|școala|scoala|colegiul|gr[ăa]dini|kindergarten|elementary|school\b|high school/i,
    uni: /universit|facultat|academia|politehnic|snspa|institutul de|college\b/i,
    park: /parcare|parking|garage\b/i,
    mall: /mall|shopping cent|shopping center|bellevue square|lincoln square|plaza\b|unirea shopping/i,
    box: /brico|dedeman|hornbach|leroy|mobexpert|altex|emag|ikea|jysk|home depot|lowe'?s|best buy|target\b|costco|decathlon|bauhaus/i,
    market: /kaufland|lidl|carrefour|mega image|profi|auchan|penny|cora\b|safeway|qfc|whole foods|trader joe|fred meyer|supermarket|idm\b/i,
    worship: /sinagog|synagog|moschee|mosque|templ/i,
    oldCivic: /muzeu|museum|bibliotec|library|teatr|theatre|theater|atene|ministerul|tribunal|ambasad|embassy|primări|palat/i,
};

/**
 * env: { city, distId, data, US, CELL, proj(lat, lon) → {x, z}, bGrid, buildingAt, nearestEdge, onRibbon, cellOf, signs,
 *        addSignQuad, brandStyle, triangulate, pointInPolygon, signedArea, str(i), TILE, TILE_GRID }
 */
export function createArchetypes(env) {
    const { US, CELL } = env;
    const stats = { specs: 0, matched: 0, byKind: {}, tweaked: 0, heightFixed: 0, tris: 0, walls: 0, meshes: 0, unmatched: [], list: [] };
    const supers = new Map(); // super-cell (2 × 2 cells) → archetype-atlas wall builder
    const mbOf = (x, z) => { const K = CELL * 2, i = Math.floor(x / K), j = Math.floor(z / K), k = i + ',' + j; let o = supers.get(k); if (!o) supers.set(k, o = { i, j, mb: new MeshBuilder(true) }); return o.mb; };
    const BI = env.data.buildingInfo || [];

    // ------------------------------------------------------------------ matching
    function match(bRecs) {
        const key = env.city.id + '-' + env.distId;
        const rows = env.data.buildingSpec || BUILDING_SPECS[key] || [];
        stats.specs = rows.length;
        for (const r0 of rows) {
            // data.buildingSpec rows carry the building index first (matched by OSM way id at build time)
            const direct = r0.length === 17, r = direct ? r0.slice(1) : r0, s = specOf(r), q = env.proj(s.lat, s.lon);
            if (direct) { const bd = bRecs[r0[0]]; if (bd && !bd.skip) { bd.spec = s; stats.matched++; } continue; }
            let b = env.buildingAt(q.x, q.z);
            if (b && (b.area / Math.max(1, s.m2) < 0.25 || b.area / Math.max(1, s.m2) > 4)) b = null;
            if (!b) { // nearest footprint of a similar size (≤ 18 m)
                let bd = 18; env.bGrid.each(q.x - 18, q.z - 18, q.x + 18, q.z + 18, (o) => { if (o.skip) return; const ra = o.area / Math.max(1, s.m2); if (ra < 0.5 || ra > 2) return; const d = Math.hypot(o.c[0] - q.x, o.c[1] - q.z); if (d < bd) { bd = d; b = o; } });
            }
            if (!b || b.skip) { if (stats.unmatched.length < 20) stats.unmatched.push([s.a, s.name || s.fronts, s.m2]); continue; }
            if (b.spec && Math.abs(Math.log(b.area / b.spec.m2)) < Math.abs(Math.log(b.area / Math.max(1, s.m2)))) continue;
            b.spec = s; stats.matched++;
        }
        for (const b of bRecs) {
            if (b.skip) continue;
            const k = b.i * 5; b.hSrc = k + 4 < BI.length ? BI[k + 4] : 0;
            const kind = kindOf(b);
            if (kind) { b.arch = kind; stats.byKind[kind] = (stats.byKind[kind] || 0) + 1; b._li = stats.list.push([kind, (b.spec && b.spec.name) || b.name || '', Math.round(b.c[0]), Math.round(b.c[1]), b.spec ? b.spec.a : b.type || '']) - 1; }
            else if (b.spec) tweak(b);
        }
    }
    /** the visual archetype of a footprint (null = the city's residential pipeline) */
    function kindOf(b) {
        const k = kindOf0(b);
        // RO: an eclectic / interwar footprint (OSM year, style zone) stays in the city's period styles unless the research
        // facade is photo-based or the building is post-war: rule-based research guesses ('modern', 'communist') were
        // wrong for e.g. Hotel Lido (1930s Magheru) or the Urseanu observatory villa
        if (!US && k && (b.style === 'eclectic' || b.style === 'interwar') && /^(office|hotel|civic|school|uni|clinic)$/.test(k) && !(b.spec && (b.spec.flags & 4)) && !(b.year >= 1950)) return null;
        // a building lower than two storeys cannot carry a lobby + upper floors: the city's pipeline (shopfronts via tweak)
        if (k && /^(cw|office|hotel|school|uni|clinic|civic)$/.test(k) && b.h - Math.max(0, b.minH) < 6.5 && !(b.spec && b.spec.st >= 2 && (b.spec.flags & 2) && (b.hSrc ?? 0) >= 2)) return null;
        return k;
    }
    function kindOf0(b) {
        const s = b.spec, nm = ((s && s.name) || b.name || '').trim(), t = b.type || '';
        if (b.cv || (s && (s.flags & 32))) return null; // CV stops / landmark parts
        if (b.minH > 0.5) return ((s && (s.a === 'cw' || s.a === 'ob' || s.a === 'ho')) || (b.style === 'glass' && /office|commercial|hotel/.test(t))) ? 'cw' : null; // a tower part on a podium
        if (s && (s.a === 'fu' || s.a === 'cvs')) return null;
        if (/\b(lukoil|omv|petrom|rompetrol|socar|mol|shell|chevron|arco|texaco|bp)\b/i.test(nm) || /turnul de ap|water tower/i.test(nm)) return null; // fuel shops (world-visual forecourts), water towers
        if (b.style === 'church' || RE.worship.test(nm) || (s && s.a === 'ch')) return null;
        const st = s ? s.style : '', old = st === 'v' || st === 'e' || (b.year && b.year < 1919);
        const storeys = (s && s.st) || b.levels || Math.round(b.h / 3.3);
        if (RE.park.test(nm) && !/garajul|ciclop/i.test(nm) || t === 'parking' || (s && s.a === 'pk')) return b.h > 5 ? 'parking' : null;
        if (/punct termic|central[ăa] termic|substa[tț]i|transformator/i.test(nm)) return 'shed'; // utility buildings
        if (s) {
            switch (s.a) {
                case 'cw': return 'cw';
                case 'ob': if (old && storeys <= 4) return null; if (RE.hotel.test(nm)) return 'hotel'; if (RE.clinic.test(nm)) return 'clinic'; return s.mat === 'cw' || s.style === 'm' || b.style === 'glass' ? 'cw' : 'office';
                case 'ho': return old && storeys <= 4 ? null : 'hotel';
                case 'ml': return b.area < 900 ? 'store' : 'mall';
                case 'su': return 'market';
                case 'in': return 'shed';
                case 'sc': return old ? null : 'school';
                case 'un': return old ? null : 'uni';
                case 'bk': return 'bank';
                case 'dt': return 'drive';
                case 'cv': {
                    if (RE.oldCivic.test(nm) || old) return null;
                    if (RE.clinic.test(nm)) return 'clinic';
                    if (RE.hotel.test(nm)) return 'hotel';
                    if (RE.school.test(nm)) return 'school';
                    if (s.style === 'm' || s.mat === 'cw' || b.style === 'glass') return 'cw';
                    if (s.style === 'c' || s.style === 'p' || s.style === 'i') return 'civic';
                    if (b.h > 25) return 'office';
                    return null;
                }
                case 'sr': case 'mx': {
                    if (RE.market.test(nm) && b.area > 500 && storeys <= 2) return 'market';
                    if (RE.box.test(nm) && b.area > 1200) return 'box';
                    if (US) return storeys > 4 || s.a === 'mx' ? 'resi' : 'store';
                    if (b.h < 6.5 && b.area < 1500) return 'shop1'; // single-storey shop / pavilion
                    return null;
                }
            }
            return null;
        }
        // no research spec: OSM type + name
        if (RE.hotel.test(nm) || t === 'hotel') return 'hotel';
        if (RE.clinic.test(nm) || t === 'hospital') return old ? null : 'clinic';
        if (/^(school|kindergarten)$/.test(t) || RE.school.test(nm)) return old ? null : 'school';
        if (/^(university|college)$/.test(t)) return old ? null : 'uni';
        if (/^(industrial|warehouse|manufacture|hangar)$/.test(t)) return 'shed';
        if (t === 'supermarket' || (RE.market.test(nm) && b.area > 600)) return 'market';
        if (RE.mall.test(nm) && b.area > 3000) return 'mall';
        if (t === 'retail' || RE.box.test(nm)) return b.area > 1500 ? 'box' : US ? 'store' : (b.h < 6.5 ? 'shop1' : null);
        if (t === 'office' || t === 'commercial') return b.style === 'glass' || (b.year >= 1995) ? 'cw' : (b.style === 'eclectic' || b.style === 'house') ? null : 'office';
        return null;
    }
    /** residential-pipeline buildings with a research spec: real ground-floor height / storeys / colour / shopfronts */
    function tweak(b) {
        const s = b.spec;
        if ((s.a === 'sr' || s.a === 'mx' || s.units > 0) && b.h > 6) { b.flags |= 1; b.gfh = clamp(s.gfh || 4.2, 3.4, 5.5); b.shopFaces = streetFaces(b).map(f => f.street); }
        if (!b.colour && s.hex) b.colour = s.hex;
        if (s.st > 0 && (s.flags & 2) && !b.levels && b.hSrc >= 2) { const h2 = Math.round(((s.gfh || 3.3) + (s.st - 1) * 3.2 + 0.6) * 10) / 10; if (Math.abs(h2 - b.h) > 1.5) { b.h = h2; stats.heightFixed++; } b.levels = s.st; }
        stats.tweaked++;
    }

    // ------------------------------------------------------------------ geometry helpers
    const clampN = clamp;
    function edgesOf(b) {
        const ring = b.ring, n = ring.length, ccw = env.signedArea(ring) > 0, out = [];
        let s0 = 0;
        for (let k = 0; k < n; k++) {
            const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % n], L = Math.hypot(bx - ax, bz - az);
            let nx = L ? (bz - az) / L : 0, nz = L ? -(bx - ax) / L : 0; if (!ccw) { nx = -nx; nz = -nz; }
            out.push({ k, ax, az, bx, bz, L, nx, nz, ux: L ? (bx - ax) / L : 1, uz: L ? (bz - az) / L : 0, s0, street: false, rank: 0, road: '', d: 99, free: 30 });
            s0 += L;
        }
        return out;
    }
    const RANK = { motorway: 6, trunk: 6, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 2, living_street: 1, service: 0 };
    /** which walls face a street (road in front within 35 m, no other building in between), + the main front */
    function streetFaces(b) {
        const E = b._edges || (b._edges = edgesOf(b));
        for (const e of E) {
            if (e.L < 3) continue;
            const mx = (e.ax + e.bx) / 2 + e.nx * 2, mz = (e.az + e.bz) / 2 + e.nz * 2;
            const ne = env.nearestEdge(mx, mz, (r) => !r.virtual && !r.tunnel, 40);
            if (!ne || ne.d > 35 || ((ne.cx - mx) * e.nx + (ne.cz - mz) * e.nz) <= 0) continue;
            const o = env.buildingAt(mx + e.nx * 1.5, mz + e.nz * 1.5); if (o && o !== b) continue;
            e.street = true; e.road = ne.edge.name || ''; e.rank = RANK[ne.edge.type?.replace('_link', '')] ?? 2; e.d = ne.d; e.drive = !!ne.edge.drivable;
            const r = ne.edge, sd = ((mx - ne.cx) * r.nx + (mz - ne.cz) * r.nz) >= 0 ? 1 : -1;
            e.free = Math.max(0, ne.d + 2 - (sd > 0 ? r.wR : r.wL) - 0.6); // wall → kerb clearance (canopies, steps, docks stay off the carriageway)
        }
        return E;
    }
    function mainEdge(b, E) {
        const fr = b.spec?.fronts || '';
        let best = null, bs = -Infinity;
        for (const e of E) {
            if (e.L < 3) continue;
            const sc = (e.street ? 10 : 0) + (fr && e.road === fr ? 6 : 0) + e.rank * 1.5 + Math.min(e.L, 40) / 8 - e.d / 15;
            if (sc > bs) { bs = sc; best = e; }
        }
        return best || E[0];
    }
    const at = (e, s, off = 0) => [e.ax + e.ux * s + e.nx * off, e.az + e.uz * s + e.nz * off];
    const ang = (e) => Math.atan2(e.ux, e.uz); // MeshBuilder.box: local z along the edge, local x along the normal
    /** a box against the wall: centre s along the edge, `dep` out from the wall, len along it */
    const ebox = (mb, e, s, out0, y, len, hgt, dep, col, tile = -1) => { const [x, z] = at(e, s, out0 + dep / 2); mb.box(x, y, z, dep, hgt, len, ang(e), col, tile); };
    /** flat projecting element: front face + top + soffit (+ ends) — cheaper than a box */
    const slab = (mb, e, s, y, len, hgt, dep, col, ends = true) => {
        const [x0, z0] = at(e, s - len / 2, dep), [x1, z1] = at(e, s + len / 2, dep), [b0x, b0z] = at(e, s - len / 2, 0.02), [b1x, b1z] = at(e, s + len / 2, 0.02);
        mb.wall(x0, z0, x1, z1, y, y + hgt, e.nx, e.nz, col);
        mb.flatQuad(b0x, b0z, b1x, b1z, x1, z1, x0, z0, y + hgt, shadeRgb(col, 1.06), 0, -1);
        const lo = mb.vc; mb.flatQuad(b0x, b0z, b1x, b1z, x1, z1, x0, z0, y, shadeRgb(col, 0.7), 0, -1); flipLast(mb, lo); // soffit, facing down
        if (ends) { mb.wall(b0x, b0z, x0, z0, y, y + hgt, -e.ux, -e.uz, shadeRgb(col, 0.88)); mb.wall(x1, z1, b1x, b1z, y, y + hgt, e.ux, e.uz, shadeRgb(col, 0.88)); }
    };
    function flipLast(mb, v0) { // turn the faces added since vertex v0 upside down (normals −y, reversed winding)
        for (let v = v0; v < mb.vc; v++) mb.n[v * 3 + 1] = -1;
        for (let i = mb.ic - 6; i < mb.ic; i += 3) { const t = mb.i[i + 1]; mb.i[i + 1] = mb.i[i + 2]; mb.i[i + 2] = t; }
    }
    /** wall band on one edge in the archetype atlas (u continues around the corner; v from the band's base) */
    const band = (e, y0, y1, tile, col, { vBase = y0, fh = 3.5, s0 = 0, s1 = e.L, off = 0, mb = null, uW = null, vH: vh = null } = {}) => {
        if (y1 - y0 < 0.05 || s1 - s0 < 0.05) return;
        const [W, H, fl] = TM[tile]; const vH = vh || (fl ? H * fh : H), uw = uW || W;
        const [x0, z0] = at(e, s0, off), [x1, z1] = at(e, s1, off);
        (mb || mbOf(e.ax, e.az)).wall(x0, z0, x1, z1, y0, y1, e.nx, e.nz, col, (e.s0 + s0) / uw, (e.s0 + s1) / uw, (y0 - vBase) / vH, (y1 - vBase) / vH, tile);
        stats.walls++;
    };
    /** a wall band in the city's own atlas (plain plaster / city window styles) into the cell's solid mesh */
    const cityBand = (c, e, y0, y1, tileName, col, fh = 3.2, bayW = 3.3) => {
        if (y1 - y0 < 0.05) return;
        const t = env.TILE[tileName] ?? 7, [gc, gr] = env.TILE_GRID[t] || [1, 1];
        c.solid.wall(e.ax, e.az, e.bx, e.bz, y0, y1, e.nx, e.nz, col, e.s0 / (bayW * gc), (e.s0 + e.L) / (bayW * gc), 0, (y1 - y0) / (fh * gr), t);
    };
    function parapet(mb, E, y, hgt, col, inset = 0.25) {
        for (const e of E) {
            if (e.L < 0.3) continue;
            mb.wall(e.ax, e.az, e.bx, e.bz, y, y + hgt, e.nx, e.nz, col);
            const [i0x, i0z] = at(e, 0, -inset), [i1x, i1z] = at(e, e.L, -inset);
            mb.wall(i1x, i1z, i0x, i0z, y, y + hgt, -e.nx, -e.nz, shadeRgb(col, 0.82));
            mb.flatQuad(e.ax, e.az, e.bx, e.bz, i1x, i1z, i0x, i0z, y + hgt, shadeRgb(col, 1.05), 0, -1);
        }
    }
    function flatRoof(c, b, y, col) { const { pts, tris } = env.triangulate(b.ring); if (tris.length) c.roof.flatPoly(pts, tris, y, col, 0.1, -1); }
    /** an oriented rectangle inside the footprint (rooftop plant, screens): shrinks until its corners are inside */
    function roofRect(b, e, fw, fd, brng, cx = b.c[0], cz = b.c[1]) {
        for (let k = 0; k < 6; k++) {
            const w = fw * (1 - k * 0.14), d = fd * (1 - k * 0.14), ox = (brng() - 0.5) * 0.2 * w, oz = (brng() - 0.5) * 0.2 * d;
            const px = cx + e.ux * ox + e.nx * oz, pz = cz + e.uz * ox + e.nz * oz;
            const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, c2]) => [px + e.ux * a - e.nx * c2, pz + e.uz * a - e.nz * c2]);
            if (pts.every(([x, z]) => env.pointInPolygon(x, z, b.ring))) return { x: px, z: pz, w, d };
        }
        return null;
    }
    function plant(c, b, e, y, brng, { screen = true, units = 4, scale = 0.38, col = rgb('#9ea3a8') } = {}) {
        const side = Math.sqrt(b.area);
        const r = roofRect(b, e, clampN(side * scale, 3, 22), clampN(side * scale * 0.65, 2.5, 14), brng);
        if (r) {
            if (screen) { // louvred screen around the plant (sandwich tile at louvre scale)
                const hgt = clampN(side * 0.06, 2.2, 3.6), mb = mbOf(r.x, r.z);
                const cs = [[-r.w / 2, -r.d / 2], [r.w / 2, -r.d / 2], [r.w / 2, r.d / 2], [-r.w / 2, r.d / 2]].map(([a, c2]) => [r.x + e.ux * a - e.nx * c2, r.z + e.uz * a - e.nz * c2]);
                for (let q = 0; q < 4; q++) {
                    const [ax, az] = cs[q], [bx, bz] = cs[(q + 1) % 4], L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
                    const mx = (ax + bx) / 2 - r.x, mz = (az + bz) / 2 - r.z, ml = Math.hypot(mx, mz) || 1;
                    mb.wall(ax, az, bx, bz, y, y + hgt, mx / ml, mz / ml, col, 0, L / 1.5, 0, hgt / 0.9, AT.sandwich);
                }
                c.solid.flatFan(cs, y + hgt - 0.3, shadeRgb(col, 0.7));
            } else c.solid.box(r.x, y, r.z, r.w, 2.2, r.d, ang(e), col);
        }
        for (let u = 0; u < units; u++) { // HVAC / AHU units, elevator overrun
            const x = b.c[0] + (brng() - 0.5) * side * 0.55, z = b.c[1] + (brng() - 0.5) * side * 0.55;
            if (!env.pointInPolygon(x, z, b.ring) || (r && Math.abs((x - r.x) * e.ux + (z - r.z) * e.uz) < r.w / 2 + 1 && Math.abs((x - r.x) * e.nx + (z - r.z) * e.nz) < r.d / 2 + 1)) continue;
            const big = brng() < 0.3;
            c.detail.box(x, y, z, big ? 3.4 : 1.6, big ? 1.8 : 1.1, big ? 2.2 : 1.2, ang(e), shadeRgb(col, 0.9 + brng() * 0.2));
            if (!big) c.detail.geo(cyl(), x, y + 1.1 + 0.075, z, 0, 0.45, 0.15, 0.45, rgb('#5b6066'));
        }
    }
    /** a sign quad (SignAtlas) on a facade / fascia, facing out of edge e at (s, y) */
    function facadeSign(c, e, s, y, text, style, maxW, maxH, out = 0.08) {
        if (!text) return null;
        const label = (style[3] || text).replace(/\s*\([^)]*\)/g, '').trim() || text; // (research logo notes such as "(octagon)" are not lettering)
        const sg = env.signs.get(label.slice(0, 26), style[0], style[1], style[2] || null); if (!sg) return null;
        let w = Math.min(maxW, maxH * sg.aspect), hh = w / sg.aspect; if (hh > maxH) { hh = maxH; w = hh * sg.aspect; }
        const [x, z] = at(e, s, out);
        env.addSignQuad(c, x, z, Math.atan2(e.nx, e.nz), 1, w, hh, y, sg, 0.02);
        return { w, h: hh };
    }
    /** a brand logo panel (supermarkets, pads): a 1.2–1.6 m board in the brand colour standing proud of the fascia, centred
     *  over the entrance, its lettering cropped to the text band so the letters fill ≈ 70 % of the panel height */
    function logoPanel(c, e, s, yBottom, text, style, maxW, hp = 1.5) {
        const label = (style[3] || text).replace(/\s*\([^)]*\)/g, '').trim() || text;
        const sg = env.signs.get(label.slice(0, 26), style[0], style[1], null); if (!sg) return null;
        const crop = 0.8, ph = clampN(hp, 1.2, 1.6), qh = ph * 0.92;
        let w = qh * sg.aspect / crop, H = qh;
        if (w > maxW) { w = maxW; H = w * crop / sg.aspect; }
        const pw = w + 0.5, dep = 0.22, yc = yBottom + ph / 2;
        ebox(c.solid, e, s, 0.02, yBottom, pw, ph, dep, rgb(style[0])); // the panel
        const dv = (sg.v1 - sg.v0) * (1 - crop) / 2, sc = { ...sg, v0: sg.v0 + dv, v1: sg.v1 - dv };
        const [x, z] = at(e, s, 0.02 + dep);
        env.addSignQuad(c, x, z, Math.atan2(e.nx, e.nz), 1, w, H, yc, sc, 0.02);
        return { w: pw, h: ph };
    }
    const signStyle = (text, def = ['#22262b', '#f2f2ef', null]) => (text && env.brandStyle(text)) || def;
    function entranceCanopy(c, e, s, y, len, dep, col, posts = false, mb = c.solid) {
        dep = Math.min(dep, e.free); if (dep < 0.8) return 0;
        slab(mb, e, s, y, len, 0.32, dep, col);
        if (posts && dep > 2) for (const f of [-0.45, 0.45]) { const [x, z] = at(e, s + f * len, dep - 0.35); c.solid.box(x, 0, z, 0.24, y, 0.24, ang(e), shadeRgb(col, 0.9)); }
        return dep;
    }
    /** RO public buildings: the national flag on a short pole over the entrance (a flag, not a brand) */
    function roFlag(c, e, s, y) {
        if (US) return;
        const [x, z] = at(e, s, 0.2), a = ang(e);
        c.detail.box(x, y, z, 0.06, 2.6, 0.06, a, rgb('#c9c9c9'));
        const [fx, fz] = at(e, s, 0.9);
        const cols = ['#002b7f', '#fcd116', '#ce1126'];
        for (let i = 0; i < 3; i++) { const [px, pz] = [fx + e.nx * i * 0.36, fz + e.nz * i * 0.36]; c.detail.box(px, y + 1.7, pz, 0.36, 0.72, 0.03, a + Math.PI / 2, rgb(cols[i])); }
    }
    const colorOf = (s, pal, brng, mix = 0.55) => {
        const p = rgb(pal[Math.floor(brng() * pal.length)]);
        if (!s || !s.hex) return p;
        const h = rgb(s.hex);
        if (s.flags & 4) return h; // photo-researched / OSM colour
        return h.map((v, i) => Math.round(v * (1 - mix) + p[i] * mix)); // dossier estimate: tone only
    };
    const jitter = (c, brng, k = 0.06) => { const j = 1 - k + brng() * k * 2; return c.map(v => Math.min(255, Math.round(v * j))); };

    const PAL = {
        cladding: ['#d9dadb', '#c9ccce', '#e3e1dc', '#b9bec2', '#9aa1a7', '#e8e6e1', '#d4cfc4'],
        spandrel: ['#e4e2dc', '#d2d4d6', '#c9c3b8', '#dcd6ca', '#b7bcc0', '#efece6'],
        glass: US ? ['#5b7f99', '#6a8a8a', '#45657d', '#8d9aa3', '#3a556b', '#7f9a96', '#6c8796'] : ['#6f8c99', '#5f7f8c', '#4f6b78', '#7c919c', '#5a7480', '#86a3ad', '#3f5a68', '#6e8f8a'],
        shed: ['#d8dadb', '#c4cad0', '#9fb1bf', '#e6e4dc', '#a9b0a6', '#7f8f9c', '#d0c8b8'],
        hotel: ['#ece8e0', '#e0dbd2', '#d6d2cc', '#c8c1b5', '#efeae2', '#d9cbb5'],
        school: ['#e8dcc0', '#efe4cc', '#e2d0b0', '#f0e8d8', '#dfe3d0', '#e9d9c9', '#e8cfa8'],
        precast: ['#cfccc4', '#c4c0b6', '#d8d4ca', '#bdb9b0'],
        concrete: ['#c9c7c2', '#bdbab3', '#d2d0ca'],
        brick: ['#8a4a3a', '#9a5a46', '#7a4636', '#a0705a', '#6e4a3e', '#b08060'],
        clinic: ['#f2f2ef', '#e9ecee', '#eef0ea', '#e4e8ea'],
        stone: ['#e3dccd', '#d8cfbd', '#ece6da', '#cfc8ba'],
    };
    const glassTint = (s, brng) => {
        if (s && s.hex) { const h = rgb(s.hex), l = (h[0] + h[1] + h[2]) / 3; if ((h[2] >= h[0] && l < 170) || (s.flags & 4)) return h; } // bluish / grey glass hex (or photo-researched)
        return rgb(PAL.glass[Math.floor(brng() * PAL.glass.length)]);
    };

    // ------------------------------------------------------------------ generators
    function storeysOf(b, gfh, fh) { const s = b.spec; const n = (s && s.st) || b.levels || Math.max(1, Math.round((b.h - gfh) / fh) + 1); return Math.max(1, n); }
    /** apply the researched storey count when the data height is only an estimate (hSrc ≥ 2) */
    function fixHeight(b, gfh, fh, top = 0.9) {
        const s = b.spec; if (!s || !(s.st > 0) || !(s.flags & 2) || b.levels > 0 || (b.hSrc ?? 0) < 2) return;
        const h2 = Math.round((gfh + (s.st - 1) * fh + top) * 10) / 10;
        if (Math.abs(h2 - b.h) > 1.5) { b.h = h2; stats.heightFixed++; }
    }

    /** curtain-wall office (RO 2000s–2020s; Bellevue towers on retail / lobby podiums) */
    function genCW(b, c, brng, E, M, y0, hotel = false) {
        const s = b.spec, tall = b.h > 45, raised = b.minH > 0.5; // (a tower part standing on a podium: no lobby)
        let gfh = raised ? 0 : clampN((s && s.gfh) || (US ? 5.5 : 4.8), 4.2, 6.5);
        fixHeight(b, gfh, 3.75, 1.2);
        const h = b.h, n = storeysOf(b, gfh, 3.75), fh = clampN((h - y0 - gfh - 1.2) / Math.max(1, n - 1), 3.3, 4.4);
        const tint = jitter(glassTint(s, brng), brng, 0.05);
        const tile = tall || brng() < 0.35 ? AT.cw2 : AT.cw;
        const podium = US || (s && s.units > 0);
        const podCol = shadeRgb(tint, 0.9);
        const yG = y0 + gfh, yTop = h + 1.2; // (the glass runs past the roof as a screen / crown)
        for (const e of E) {
            if (e.L < 0.2) continue;
            band(e, yG, yTop, tile, tint, { vBase: yG, fh });
            if (raised) continue;
            if (e.street || e === M) band(e, y0, yG, podium ? AT.store : AT.front, [255, 255, 255], { fh: gfh, vBase: y0 });
            else band(e, y0, yG, AT.panel, rgb('#7c8288'), { vBase: y0 });
        }
        // floor-edge band under the glazing of the first floor + vertical fins every 3 m on street faces (near LOD)
        const fin = shadeRgb(tint, 0.6), dark = rgb('#2c3136');
        for (const e of E) {
            if (e.L < 4) continue;
            if (!raised) slab(c.solid, e, e.L / 2, yG - 0.5, e.L, 0.5, 0.25, dark, false);
            if (!e.street) continue;
            for (let t = 1.5; t < e.L - 0.5; t += 3) { const [x, z] = at(e, t, 0.1); c.detail.box(x, yG, z, 0.2, yTop - yG - 0.2, 0.1, ang(e), fin); }
        }
        // entrance: recessed-look portal (dark frame) + cantilevered canopy with the building's name
        if (M && M.L > 6 && !raised) {
            const w = clampN(M.L * 0.35, 6, 16), sm = M.L / 2;
            ebox(c.solid, M, sm, 0, y0, w + 0.6, gfh - 0.6, 0.25, dark);
            band(M, y0 + 0.02, y0 + gfh - 0.75, AT.front, [255, 255, 255], { s0: sm - w / 2, s1: sm + w / 2, off: 0.27, fh: gfh, vBase: y0 });
            const cd = entranceCanopy(c, M, sm, y0 + gfh - 0.6, w + 2, hotel ? 5 : US ? 3.2 : 2.6, rgb('#3a4048'), hotel);
            const nm = (s && s.sign && s.sign.endsWith('|e')) ? s.sign.slice(0, -2) : null;
            if (nm && cd) { facadeSign(c, M, sm, y0 + gfh - 0.6 + 0.16, nm, ['#3a4048', '#f4f4f2', null], w * 0.9, 0.3, cd + 0.05); b._signed = true; }
        }
        flatRoof(c, b, h, rgb('#55595d'));
        // crown: the glass screen above the roof (inner face) + plant inside it
        for (const e of E) if (e.L > 0.2) { const [i0x, i0z] = at(e, 0, -0.05), [i1x, i1z] = at(e, e.L, -0.05); c.solid.wall(i1x, i1z, i0x, i0z, h, yTop, -e.nx, -e.nz, shadeRgb(tint, 0.5)); }
        plant(c, b, M, h, brng, { screen: b.area > 400, units: Math.min(6, Math.floor(b.area / 300)) });
        return { h: yTop, signY: y0 + gfh - 1.2 };
    }

    /** office block with punched / ribbon windows (precast socialist, 1990s plaster + glass, US brick) */
    function genOffice(b, c, brng, E, M, y0, flavour = null) {
        const s = b.spec;
        const gfh = clampN((s && s.gfh) || 4.2, 3.6, 5.5);
        fixHeight(b, gfh, 3.5);
        const h = b.h, n = storeysOf(b, gfh, 3.5), fh = clampN((h - y0 - gfh - 0.8) / Math.max(1, n - 1), 3.0, 4.2);
        let tile = AT.office, pal = PAL.spandrel;
        const st = s ? s.style : '', mat = s ? s.mat : '';
        if (flavour) tile = flavour;
        else if (US && (mat === 'rb' || mat === 'us' || brng() < 0.4)) { tile = AT.brick; pal = PAL.brick; }
        else if (st === 'c' || mat === 'cc' || mat === 'cf' || (b.year && b.year >= 1950 && b.year < 1990)) { tile = AT.precast; pal = PAL.precast; }
        else if (mat === 'st') { tile = AT.stone; pal = PAL.stone; }
        else if (st === 'i' || (b.year && b.year < 1950)) { tile = AT.inst; pal = PAL.stone; }
        const col = jitter(colorOf(s, pal, brng), brng);
        const yG = y0 + gfh;
        const shops = s && s.units > 0;
        for (const e of E) {
            if (e.L < 0.2) continue;
            band(e, yG, h, tile, col, { vBase: yG, fh });
            if ((e.street && shops) || e === M) band(e, y0, yG, US ? AT.store : AT.front, [255, 255, 255], { fh: gfh, vBase: y0 });
            else band(e, y0, yG, tile, shadeRgb(col, 0.92), { vBase: y0 - (fh - gfh), fh });
        }
        const trim = shadeRgb(col, 0.8);
        for (const e of E) if (e.L > 4 && e.street) slab(c.solid, e, e.L / 2, yG - 0.35, e.L, 0.35, 0.3, trim, false); // ground-floor cornice
        if (M && M.L > 6) {
            const w = clampN(M.L * 0.3, 5, 12);
            const cd = entranceCanopy(c, M, M.L / 2, yG - 0.55, w, 2.2, rgb('#3d4248'));
            const nm = (s && s.sign && s.sign.endsWith('|e')) ? s.sign.slice(0, -2) : null;
            if (nm && cd) { facadeSign(c, M, M.L / 2, yG - 0.55 + 0.16, nm, ['#3d4248', '#f4f4f2', null], w * 0.9, 0.3, cd + 0.05); b._signed = true; }
        }
        parapet(c.solid, E, h, 0.8, shadeRgb(col, 0.86));
        flatRoof(c, b, h, rgb('#6c6a66'));
        plant(c, b, M, h, brng, { screen: b.area > 700, units: Math.min(5, Math.floor(b.area / 250)) });
        return { h: h + 0.8, signY: y0 + gfh - 1.1 };
    }

    /** hotel: room-window grid, glazed lobby, entrance canopy (posts), roof letters only where researched */
    function genHotel(b, c, brng, E, M, y0) {
        const s = b.spec;
        if ((s && (s.style === 'm' || s.mat === 'cw')) || b.style === 'glass') return genCW(b, c, brng, E, M, y0, true);
        const gfh = clampN((s && s.gfh) || 4.8, 4.0, 6.0);
        fixHeight(b, gfh, 3.1);
        const h = b.h, n = storeysOf(b, gfh, 3.1), fh = clampN((h - y0 - gfh - 0.8) / Math.max(1, n - 1), 2.9, 3.6);
        const brick = US && s && (s.mat === 'rb' || s.mat === 'us');
        const tile = brick ? AT.brick : AT.hotel, col = jitter(colorOf(s, brick ? PAL.brick : PAL.hotel, brng), brng);
        const yG = y0 + gfh;
        for (const e of E) {
            if (e.L < 0.2) continue;
            band(e, yG, h, tile, col, { vBase: yG, fh });
            band(e, y0, yG, e.street || e === M ? AT.front : tile, e.street || e === M ? [255, 255, 255] : shadeRgb(col, 0.9), { fh: e.street || e === M ? gfh : fh, vBase: y0 });
        }
        for (const e of E) if (e.L > 4) slab(c.solid, e, e.L / 2, yG - 0.4, e.L, 0.4, 0.35, shadeRgb(col, 0.78), false);
        if (M && M.L > 8) {
            const big = n >= 8 || b.area > 1500, w = clampN(M.L * 0.3, 6, big ? 16 : 10);
            entranceCanopy(c, M, M.L / 2, yG - 0.5, w, big ? 5.5 : 3, rgb('#2f3337'), big);
        }
        parapet(c.solid, E, h, 1.0, shadeRgb(col, 0.82));
        flatRoof(c, b, h, rgb('#6c6a66'));
        plant(c, b, M, h, brng, { screen: false, units: Math.min(4, Math.floor(b.area / 300)) });
        const nm = s && s.sign && s.sign.endsWith('|t') ? s.sign.slice(0, -2) : null; // researched roof letters
        if (nm && M) {
            const sg = env.signs.get(nm.slice(0, 26), '#1c1f24', '#ffffff', null);
            if (sg) { const w = Math.min(M.L * 0.7, 16), hh = w / sg.aspect, [x, z] = at(M, M.L / 2, -0.6); env.addSignQuad(c, x, z, Math.atan2(M.nx, M.nz), 1, w, hh, h + 1.1 + hh / 2, sg, 0.1); for (const f of [-0.4, 0.4]) { const [px, pz] = at(M, M.L / 2 + f * w, -0.7); c.solid.box(px, h, pz, 0.12, 1.2 + hh, 0.12, ang(M), rgb('#3a3d42')); } b._signed = true; }
        }
        return { h: h + 1.0, signY: yG - 1.2 };
    }

    /** loading side: roller doors + dock levellers / bumpers on the back wall */
    function loadingDocks(c, E, M, y0, nDoors, brng) {
        const back = E.filter(e => e !== M && e.L > 9 && !(e.street && e.rank >= 4)).sort((a, b2) => (a.nx * M.nx + a.nz * M.nz) - (b2.nx * M.nx + b2.nz * M.nz) || b2.L - a.L)[0];
        if (!back) return;
        const n = Math.min(nDoors, Math.floor(back.L / 6));
        for (let i = 0; i < n; i++) {
            const sd = back.L / 2 + (i - (n - 1) / 2) * 5.2;
            const dock = brng() < 0.6 && back.free > 4;
            const dy = y0 + (dock ? 1.2 : 0), dh = dock ? 3.0 : 4.2;
            band(back, dy, dy + dh, AT.sandwich, rgb('#7f8a94'), { s0: sd - 1.6, s1: sd + 1.6, off: 0.06, uW: 2, vH: 0.5, vBase: dy, mb: mbOf(back.ax, back.az) }); // roller door
            for (const f of [-1.72, 1.72]) ebox(c.solid, back, sd + f, 0, dy, 0.22, dh, 0.14, rgb('#3e4247')); // jambs
            ebox(c.solid, back, sd, 0, dy + dh, 3.6, 0.5, 0.35, rgb('#4a4e53')); // door head / coil box
            if (dock) { ebox(c.solid, back, sd, 0, y0, 3.4, 1.2, 2.6, rgb('#8e8d89')); for (const f of [-1.3, 1.3]) ebox(c.detail, back, sd + f, 2.6, y0 + 0.6, 0.3, 0.45, 0.15, rgb('#1d1d1f')); ebox(c.detail, back, sd, 0.06, dy - 0.1, 3.9, dh + 0.5, 0.5, rgb('#26282b')); }
        }
    }
    /** a glazed entrance portal (mall / big box): a taller glass box in front of the main wall with a canopy + name */
    function portal(c, b, e, s, w, hgt, y0, name, brng) {
        const dep = clampN(e.free - 0.3, 0.4, 1.6), mb = mbOf(e.ax, e.az), cdep = Math.min(2.2, e.free - dep);
        const [p0x, p0z] = at(e, s - w / 2, dep), [p1x, p1z] = at(e, s + w / 2, dep), [q0x, q0z] = at(e, s - w / 2, 0), [q1x, q1z] = at(e, s + w / 2, 0);
        mb.wall(p0x, p0z, p1x, p1z, y0, y0 + hgt, e.nx, e.nz, rgb('#7d93a0'), 0, w / 6, 0, hgt / 7.5, AT.cw);
        mb.wall(q0x, q0z, p0x, p0z, y0, y0 + hgt, -e.ux, -e.uz, rgb('#6f8592'), 0, dep / 6, 0, hgt / 7.5, AT.cw);
        mb.wall(p1x, p1z, q1x, q1z, y0, y0 + hgt, e.ux, e.uz, rgb('#6f8592'), 0, dep / 6, 0, hgt / 7.5, AT.cw);
        c.roof.flatQuad(q0x, q0z, q1x, q1z, p1x, p1z, p0x, p0z, y0 + hgt, rgb('#4f5357'), 0.1, -1);
        const fr = rgb('#33373c');
        slab(c.solid, e, s, y0 + hgt - 0.6, w + 0.4, 0.6, dep + 0.15, fr); // frame / fascia
        band(e, y0, y0 + 3.4, AT.front, [255, 255, 255], { s0: s - w * 0.4, s1: s + w * 0.4, off: dep + 0.04, fh: 3.4, vBase: y0, mb }); // doors
        if (cdep > 0.6) slab(c.solid, e, s, y0 + 3.6, w * 0.85, 0.3, dep + cdep, fr); // canopy over the doors
        if (name) { const st = signStyle(name); const r = facadeSign(c, e, s, y0 + hgt - 0.3 - Math.min(2.2, hgt * 0.16), name, st, w * 0.9, Math.min(2.2, hgt * 0.22), dep + 0.2); if (r) b._signed = true; }
    }

    /** mall / retail box: blank cladding, signage band, glazed entrance portal(s), shop windows at street level, docks */
    function genBox(b, c, brng, E, M, y0, mall) {
        const s = b.spec;
        const gfh = clampN((s && s.gfh) || 5, 4.2, 6);
        if (mall) fixHeight(b, gfh, 4.5, 1.5); else if (b.h > 14 && !(b.levels > 0) && (b.hSrc ?? 0) >= 2) b.h = 10.5;
        const h = b.h;
        const col = jitter(colorOf(s, PAL.cladding, brng, 0.4), brng, 0.04);
        const shed = !mall && (s ? s.mat === 'sp' || s.mat === 'mc' : brng() < 0.5);
        for (const e of E) {
            if (e.L < 0.2) continue;
            const shopWin = (mall || (s && (s.a === 'sr' || s.a === 'mx'))) && e.street && e.L > 8 && e.rank >= 2; // (malls / showrooms: shop windows on the street fronts)
            if (shopWin) { band(e, y0, y0 + gfh, AT.front, [255, 255, 255], { fh: gfh, vBase: y0 }); band(e, y0 + gfh, h, AT.panel, col, { vBase: y0 + gfh }); }
            else band(e, y0, h, shed ? AT.sandwich : AT.panel, col, { vBase: y0 });
        }
        // signage band along the street fronts (darker cladding strip at the top) + parapet
        const sb = shadeRgb(col, 0.55);
        for (const e of E) if (e.street && e.L > 6) slab(c.solid, e, e.L / 2, h - 1.6, e.L, 1.2, 0.18, sb, false);
        parapet(c.solid, E, h, 0.6, shadeRgb(col, 0.9), 0.2);
        if (M && M.L > 10) {
            const name = (s && s.name) || ((b.flags & 2) ? b.name : '') || '';
            const w = clampN(M.L * 0.22, 8, 18);
            portal(c, b, M, M.L / 2 + (mall ? 0 : (brng() - 0.5) * M.L * 0.3), w, Math.min(h + 2.5, h * 1.25), y0, name, brng);
            if (mall && M.L > 80) portal(c, b, M, M.L * 0.15, w * 0.7, h + 1.5, y0, '', brng);
        }
        loadingDocks(c, E, M, y0, mall ? 3 : 2, brng);
        flatRoof(c, b, h, rgb('#7a7c7e'));
        // skylight strips + HVAC rows
        const side = Math.sqrt(b.area);
        if (M && b.area > 1500) for (let k = -1; k <= 1; k++) { const r = roofRect(b, M, side * 0.5, 2.2, brng, b.c[0] + M.nx * k * side * 0.18, b.c[1] + M.nz * k * side * 0.18); if (r) c.solid.box(r.x, h, r.z, 2.2, 0.45, r.w, ang(M), rgb('#b9c6cf')); }
        plant(c, b, M, h, brng, { screen: false, units: Math.min(10, Math.floor(b.area / 350)) });
        return { h: h + 0.6, signY: y0 + gfh - 1.0 };
    }

    /** supermarket: single-storey box, glazed front with fascia in the brand colour, canopy, trolley shelter */
    function genMarket(b, c, brng, E, M, y0) {
        const s = b.spec;
        if ((b.hSrc ?? 0) >= 2 && !(b.levels > 0) && b.h > 9 && !(s && s.st >= 2)) b.h = 7.0;
        const h = b.h, front = clampN(Math.min(h - 1.6, 4.4), 3.2, 4.6);
        const name = (s && s.name) || ((b.flags & 2) ? b.name : '');
        const bs = name ? signStyle(name) : null;
        const col = jitter(colorOf(s, PAL.cladding, brng, 0.4), brng, 0.04);
        const fascia = bs ? rgb(bs[0]) : rgb('#3a3f45');
        for (const e of E) {
            if (e.L < 0.2) continue;
            if (e === M || (e.street && e.L > 12 && e.rank >= 3)) {
                band(e, y0, y0 + front, AT.front, [255, 255, 255], { fh: front, vBase: y0 });
                band(e, y0 + front, h, AT.panel, col, { vBase: y0 + front });
                slab(c.solid, e, e.L / 2, y0 + front + 0.15, e.L, Math.min(1.3, h - front - 0.3), 0.22, fascia, false); // fascia band in the brand colour
            } else band(e, y0, h, AT.panel, col, { vBase: y0 });
        }
        if (M && M.L > 6) {
            if (M.free > 0.8) slab(c.solid, M, M.L / 2, y0 + front - 0.05, M.L - 0.4, 0.28, Math.min(2.4, M.free), rgb('#e4e4e2'), true); // canopy along the front
            if (name && bs && logoPanel(c, M, M.L / 2, y0 + front + 0.3, name, bs, Math.min(M.L * 0.6, 9), 1.5)) b._signed = true; // (above the canopy; may rise past a low parapet, as real store signs do)
            // trolley shelter on the forecourt (when there is room: not on a road, not in a building)
            if (b.area > 600) for (const f of [0.18, 0.82]) {
                const [x, z] = at(M, M.L * f, 5.5);
                if (env.onRibbon(x, z, 3) || env.buildingAt(x, z) || env.buildingAt(...at(M, M.L * f, 8))) continue;
                const a = ang(M), mb = c.detail;
                mb.box(x, 2.15, z, 1.8, 0.12, 4.2, a, rgb('#8a9097')); // roof
                for (const g2 of [-1.9, 1.9]) { const [px, pz] = [x - M.nx * 0.8 + M.ux * g2, z - M.nz * 0.8 + M.uz * g2]; mb.box(px, 0, pz, 0.08, 2.15, 0.08, a, rgb('#5c6066')); }
                for (let r = 0; r < 2; r++) { const [tx, tz] = [x + M.nx * (r - 0.5) * 0.7, z + M.nz * (r - 0.5) * 0.7]; mb.box(tx, 0.15, tz, 0.55, 0.85, 3.6, a, rgb('#b8bcc0')); }
                break;
            }
        }
        loadingDocks(c, E, M, y0, 1, brng);
        parapet(c.solid, E, h, 0.5, shadeRgb(col, 0.88), 0.2);
        flatRoof(c, b, h, rgb('#7a7c7e'));
        plant(c, b, M, h, brng, { screen: false, units: Math.min(6, Math.floor(b.area / 300)) });
        return { h: h + 0.5, signY: y0 + front + 0.2 };
    }

    /** multi-storey car park: open decks (texture), parapets, roof deck with lighting poles + stair / lift tower */
    function genParking(b, c, brng, E, M, y0) {
        const s = b.spec, lv = 3.0;
        let levels = (s && s.st) || b.levels || Math.max(1, Math.round((b.h - 1.1) / lv));
        if ((b.hSrc ?? 0) >= 2 || !(b.levels > 0)) b.h = levels * lv + 1.1; else levels = Math.max(1, Math.round((b.h - 1.1) / lv));
        const deck = y0 + levels * lv, h = deck + 1.1;
        const col = jitter(colorOf(s, PAL.concrete, brng, 0.5), brng, 0.04);
        for (const e of E) {
            if (e.L < 0.2) continue;
            band(e, y0, deck, AT.park, col, { vBase: y0, fh: lv }); // (each level: parapet, open deck, slab edge)
            band(e, deck, h, AT.park, col, { vBase: deck, fh: lv }); // top parapet = the lower part of the tile
        }
        for (const e of E) if (e.L > 0.3) { const [i0x, i0z] = at(e, 0, -0.25), [i1x, i1z] = at(e, e.L, -0.25); c.solid.wall(i1x, i1z, i0x, i0z, deck, h, -e.nx, -e.nz, shadeRgb(col, 0.85)); c.solid.flatQuad(e.ax, e.az, e.bx, e.bz, i1x, i1z, i0x, i0z, h, shadeRgb(col, 1.05), 0, -1); }
        flatRoof(c, b, deck, rgb('#8a8884'));
        // roof deck: bay stripes, light poles, stair / lift core
        if (M) {
            const side = Math.sqrt(b.area), r = roofRect(b, M, side * 0.7, side * 0.5, brng);
            if (r) for (let t = -r.w / 2 + 2.5; t <= r.w / 2 - 2.5; t += 2.5) { const x = r.x + M.ux * t, z = r.z + M.uz * t; c.detail.box(x, deck + 0.01, z, r.d * 0.9, 0.02, 0.12, ang(M), rgb('#e8e8e6')); }
            const nP = Math.min(6, Math.floor(b.area / 500));
            for (let p = 0; p < nP; p++) { const x = b.c[0] + (brng() - 0.5) * side * 0.6, z = b.c[1] + (brng() - 0.5) * side * 0.6; if (!env.pointInPolygon(x, z, b.ring)) continue; c.detail.box(x, deck, z, 0.16, 6, 0.16, 0, rgb('#7d8186')); c.detail.box(x, deck + 6, z, 0.7, 0.18, 0.35, ang(M), rgb('#3c4045')); }
            const core = roofRect(b, M, 5, 5, brng, b.c[0] + (b.ring[0][0] - b.c[0]) * 0.6, b.c[1] + (b.ring[0][1] - b.c[1]) * 0.6) || roofRect(b, M, 5, 5, brng);
            if (core) { c.solid.box(core.x, deck, core.z, core.w, 4.2, core.d, ang(M), shadeRgb(col, 0.95)); c.solid.box(core.x, deck + 4.2, core.z, core.w + 0.4, 0.3, core.d + 0.4, ang(M), shadeRgb(col, 0.7)); }
            // entry: the generic blue P pictogram over the entrance (a traffic sign, not a brand)
            const sg = env.signs.get('P', '#1d4ed8', '#ffffff', null, true);
            if (sg && M.L > 6) { const [x, z] = at(M, M.L * 0.25, 0.12); env.addSignQuad(c, x, z, Math.atan2(M.nx, M.nz), 1, 1.2, 1.2, y0 + lv * 0.37 + 2.3, sg, 0.05); }
        }
        return { h, signY: y0 + 2.4 };
    }

    /** industrial shed / warehouse / workshop: cladding, plinth, roller doors, docks; old RO works in plaster */
    function genShed(b, c, brng, E, M, y0) {
        const s = b.spec;
        if ((b.hSrc ?? 0) >= 2 && !(b.levels > 0) && b.h > 14 && !(s && s.st > 2)) b.h = clampN(6 + Math.sqrt(b.area) * 0.08, 6, 12);
        const h = b.h, oldWorks = !US && ((s && s.mat === 'pl') || (b.year && b.year < 1970));
        const col = jitter(colorOf(s, oldWorks ? PAL.precast : PAL.shed, brng, 0.4), brng, 0.05);
        const tile = oldWorks ? AT.works : (s && s.mat === 'sp') || brng() < 0.45 ? AT.sandwich : AT.corr;
        for (const e of E) {
            if (e.L < 0.2) continue;
            cityBand(c, e, y0, y0 + (oldWorks ? 0.6 : 0.9), 'plain', rgb('#9c9a95'));
            band(e, y0 + (oldWorks ? 0.6 : 0.9), h, tile, col, { vBase: oldWorks ? y0 : y0 + 0.9, fh: oldWorks ? clampN(h - y0, 3.5, 6) : 3.5 });
        }
        if (M) { // roller doors on the main / service front
            const n = Math.min(3, Math.floor(M.L / 9));
            for (let i = 0; i < n; i++) { const sd = M.L / 2 + (i - (n - 1) / 2) * 7; const dh = Math.min(4.5, h - 1.2); band(M, y0, y0 + dh, AT.sandwich, rgb('#7f8a94'), { s0: sd - 2, s1: sd + 2, off: 0.06, uW: 2, vH: 0.5, vBase: y0, mb: mbOf(M.ax, M.az) }); for (const f of [-2.12, 2.12]) ebox(c.solid, M, sd + f, 0, y0, 0.22, dh, 0.14, rgb('#3e4247')); ebox(c.solid, M, sd, 0, y0 + dh, 4.4, 0.5, 0.4, rgb('#4a4e53')); }
            if (n === 0 && M.L > 3) ebox(c.solid, M, M.L / 2, 0, y0, 1.1, 2.2, 0.08, rgb('#4a4e53')); // service door
        }
        if (b.area > 900) loadingDocks(c, E, M, y0, 2, brng);
        if (b.roof === 'flat' || !b.roof) {
            parapet(c.solid, E, h, 0.4, shadeRgb(col, 0.85), 0.15);
            flatRoof(c, b, h, rgb('#8d8f91'));
            if (M && b.area > 400) { const side = Math.sqrt(b.area); for (let k = -1; k <= 1; k++) { const r = roofRect(b, M, side * 0.55, 1.6, brng, b.c[0] + M.nx * k * side * 0.2, b.c[1] + M.nz * k * side * 0.2); if (r) c.solid.box(r.x, h, r.z, 1.6, 0.35, r.w, ang(M), rgb('#c5d0d6')); } }
            plant(c, b, M, h, brng, { screen: false, units: Math.min(3, Math.floor(b.area / 600)), col: rgb('#8e9399') });
            return { h: h + 0.4, signY: Math.min(h - 1, y0 + 4.6) };
        }
        return { h, roof: true, signY: Math.min(h - 1, y0 + 4.6) }; // pitched: the city's roof code
    }

    /** schools / universities / clinics / civic blocks (RO socialist / interwar / modern; US brick) */
    function genInst(b, c, brng, E, M, y0, kind) {
        const s = b.spec;
        const gfh = clampN((s && s.gfh) || 3.8, 3.4, 4.8);
        const fh0 = kind === 'school' ? 3.6 : kind === 'clinic' ? 3.6 : 3.5;
        fixHeight(b, gfh, fh0);
        const h = b.h, n = storeysOf(b, gfh, fh0), fh = clampN((h - y0 - gfh - 0.6) / Math.max(1, n - 1), 3.0, 4.6);
        const st = s ? s.style : '', yr = b.year || (s && s.year) || 0;
        let tile, pal;
        if (US) { tile = kind === 'clinic' ? AT.office : AT.brick; pal = kind === 'clinic' ? PAL.clinic : PAL.brick; }
        else if (kind === 'clinic') { tile = st === 'c' ? AT.precast : AT.office; pal = st === 'c' ? PAL.precast : PAL.clinic; }
        else if (st === 'i' || (yr && yr >= 1919 && yr < 1950)) { tile = AT.inst; pal = PAL.school; }
        else if (kind === 'school') { tile = AT.school; pal = PAL.school; }
        else if (kind === 'uni') { tile = st === 'm' || st === 'p' || yr >= 1995 ? AT.office : AT.precast; pal = tile === AT.office ? PAL.spandrel : PAL.precast; }
        else { tile = s && s.mat === 'st' ? AT.stone : st === 'c' ? AT.precast : AT.inst; pal = tile === AT.stone ? PAL.stone : tile === AT.precast ? PAL.precast : PAL.school; }
        const col = jitter(colorOf(s, pal, brng, kind === 'school' ? 0.35 : 0.5), brng, 0.05);
        const yG = y0 + gfh;
        for (const e of E) {
            if (e.L < 0.2) continue;
            band(e, yG, h, tile, col, { vBase: yG, fh });
            band(e, y0, yG, tile, shadeRgb(col, 0.94), { vBase: yG - fh, fh });
        }
        const trim = mixRgb(col, [240, 238, 232], 0.4);
        for (const e of E) if (e.L > 4) { slab(c.solid, e, e.L / 2, y0, e.L, 0.7, 0.12, shadeRgb(col, 0.7), false); if (e.street) slab(c.detail, e, e.L / 2, yG - 0.3, e.L, 0.3, 0.2, trim, false); }
        if (M && M.L > 6) {
            const w = clampN(M.L * 0.25, 4, kind === 'clinic' ? 12 : 9);
            band(M, y0 + 0.02, y0 + Math.min(3.0, gfh - 0.4), AT.front, [255, 255, 255], { s0: M.L / 2 - w * 0.35, s1: M.L / 2 + w * 0.35, off: 0.05, fh: 3.0, vBase: y0 });
            entranceCanopy(c, M, M.L / 2, y0 + Math.min(3.2, gfh - 0.3), w, kind === 'clinic' ? 3.2 : 2.2, kind === 'clinic' ? rgb('#d9dcdf') : shadeRgb(col, 0.85), kind !== 'clinic');
            if (M.free > 0.6) ebox(c.solid, M, M.L / 2, 0, y0 - 0.02, w, 0.3, Math.min(2.0, M.free), rgb('#b1aea7')); // steps / landing
            if (kind !== 'clinic') roFlag(c, M, M.L / 2 + w * 0.3, y0 + Math.min(3.2, gfh - 0.3) + 0.35);
        }
        if (b.roof === 'flat' || !b.roof) { parapet(c.solid, E, h, 0.6, shadeRgb(col, 0.85)); flatRoof(c, b, h, rgb('#6f6d69')); plant(c, b, M, h, brng, { screen: false, units: Math.min(3, Math.floor(b.area / 500)) }); return { h: h + 0.6, signY: y0 + 2.6 }; }
        for (const e of E) if (e.L > 1) slab(c.solid, e, e.L / 2, h - 0.5, e.L, 0.5, 0.35, trim, false); // eaves cornice
        return { h, roof: true, signY: y0 + 2.6 };
    }

    /** US storefront rows (1–3 storeys) and apartments over retail; RO single-storey shops / pavilions */
    function genStore(b, c, brng, E, M, y0, kind) {
        const s = b.spec;
        const gfh = clampN((s && s.gfh) || (US ? 4.8 : 4.0), 3.4, 6);
        fixHeight(b, gfh, kind === 'resi' ? 3.0 : 3.6);
        const h = b.h, single = h - y0 < gfh + 2.2;
        const brick = US && (kind === 'store' ? brng() < 0.55 : brng() < 0.25);
        const upTile = kind === 'resi' ? AT.hotel : brick ? AT.brick : US ? AT.panel : AT.panel;
        const col = jitter(colorOf(s, brick ? PAL.brick : US ? PAL.cladding : PAL.hotel, brng, 0.45), brng, 0.05);
        const yG = y0 + (single ? Math.min(gfh, h - y0 - 1.0) : gfh);
        const n = storeysOf(b, gfh, 3.1), fh = clampN((h - yG - 0.6) / Math.max(1, n - 1), 2.8, 3.8);
        const frontTile = US ? AT.store : AT.front;
        for (const e of E) {
            if (e.L < 0.2) continue;
            if (e.street || e === M) band(e, y0, yG, frontTile, [255, 255, 255], { fh: yG - y0, vBase: y0 });
            else if (US) band(e, y0, yG, AT.panel, shadeRgb(col, 0.9), { vBase: y0 });
            else cityBand(c, e, y0, yG, 'plain', shadeRgb(col, 0.95));
            if (single) { if (US) band(e, yG, h, AT.panel, col, { vBase: yG }); else cityBand(c, e, yG, h, 'plain', col); }
            else if (!US && kind === 'shop1') cityBand(c, e, yG, h, 'house', col, fh, 3.4); // (RO shop houses: the city's window style upstairs)
            else band(e, yG, h, upTile, col, { vBase: yG, fh });
        }
        // fascia / canopy over the shop fronts, cornice / parapet
        const can = US ? rgb('#2f3337') : shadeRgb(col, 0.6);
        for (const e of E) if ((e.street || e === M) && e.L > 4 && e.free > 0.5) { slab(c.solid, e, e.L / 2, yG - 0.05, e.L - 0.2, 0.32, Math.min(US ? 1.8 : 0.9, e.free), can, true); }
        parapet(c.solid, E, h, single ? 0.7 : 0.9, shadeRgb(col, 0.85), 0.2);
        if (b.roof === 'flat' || !b.roof || US) { flatRoof(c, b, h, rgb('#6f6d69')); plant(c, b, M, h, brng, { screen: false, units: Math.min(3, Math.floor(b.area / 300)) }); return { h: h + 0.8, signY: yG - 0.95 }; }
        return { h, roof: true, signY: yG - 0.95 };
    }

    /** bank branch / drive-thru pad (Bellevue): storefront glazing, stone / brick piers, parapet band, drive-thru canopy */
    function genPad(b, c, brng, E, M, y0, kind) {
        const s = b.spec;
        if ((b.hSrc ?? 0) >= 2 && b.h > 9 && !(s && s.st >= 2)) b.h = kind === 'drive' ? 6.2 : 8.5;
        const h = b.h, front = Math.min(h - 1.4, 4.2);
        const col = jitter(colorOf(s, kind === 'drive' ? PAL.brick : PAL.stone, brng, 0.4), brng, 0.04);
        for (const e of E) {
            if (e.L < 0.2) continue;
            const glazed = e.street || e === M;
            if (glazed) band(e, y0, y0 + front, AT.store, [255, 255, 255], { fh: front, vBase: y0 });
            else band(e, y0, y0 + front, kind === 'drive' ? AT.brick : AT.stone, col, { vBase: y0 - 2, fh: 3.6 });
            band(e, y0 + front, h, kind === 'drive' ? AT.brick : AT.stone, col, { vBase: y0 + front - 1.2, fh: 3.6 });
        }
        parapet(c.solid, E, h, 1.0, shadeRgb(col, 0.8), 0.25);
        flatRoof(c, b, h, rgb('#6f6d69'));
        if (kind === 'drive') { // drive-thru window canopy on the side wall
            const side = E.filter(e => e !== M && e.L > 6).sort((a, b2) => b2.L - a.L)[0];
            if (side && side.free > 1) { slab(c.solid, side, side.L * 0.6, y0 + 3.0, 4.5, 0.4, Math.min(2.6, side.free), rgb('#2f3337')); band(side, y0 + 0.9, y0 + 2.2, AT.front, [255, 255, 255], { s0: side.L * 0.6 - 1, s1: side.L * 0.6 + 1, off: 0.05, fh: 3, vBase: y0 }); }
        }
        const name = (s && s.name) || ((b.flags & 2) ? b.name : '');
        if (M && name) { const st = signStyle(name, null); if (st && logoPanel(c, M, M.L / 2, y0 + front + 0.15, name, st, Math.min(M.L * 0.6, 6), 1.3)) b._signed = true; }
        plant(c, b, M, h, brng, { screen: false, units: 2 });
        return { h: h + 1.0, signY: y0 + front + 0.2 };
    }

    // ------------------------------------------------------------------ emit (one building, from world.js)
    function emit(b, c, brng) {
        if (!b.arch || b.skip) return null;
        const E = streetFaces(b), M = mainEdge(b, E);
        const y0 = Math.max(0, b.minH) + 0.18;
        let r = null;
        const d0 = c.detail.ic, s0 = c.solid.ic;
        try {
            switch (b.arch) {
                case 'cw': r = genCW(b, c, brng, E, M, y0); break;
                case 'office': r = genOffice(b, c, brng, E, M, y0); break;
                case 'hotel': r = genHotel(b, c, brng, E, M, y0); break;
                case 'mall': r = genBox(b, c, brng, E, M, y0, true); break;
                case 'box': r = genBox(b, c, brng, E, M, y0, false); break;
                case 'market': r = genMarket(b, c, brng, E, M, y0); break;
                case 'parking': r = genParking(b, c, brng, E, M, y0); break;
                case 'shed': r = genShed(b, c, brng, E, M, y0); break;
                case 'school': case 'uni': case 'clinic': case 'civic': r = genInst(b, c, brng, E, M, y0, b.arch); break;
                case 'store': case 'resi': case 'shop1': r = genStore(b, c, brng, E, M, y0, b.arch); break;
                case 'bank': case 'drive': r = genPad(b, c, brng, E, M, y0, b.arch); break;
            }
        } catch (err) { console.warn('[arch] building failed', b.arch, b.name, err); return null; }
        if (!r) return null;
        stats.tris += (c.detail.ic - d0 + c.solid.ic - s0) / 3; // (+ the archetype-atlas walls, counted in finish())
        b.signY = r.signY;
        if (b._li != null && M) stats.list[b._li].push(Math.round((M.ax + M.bx) / 2), Math.round((M.az + M.bz) / 2), +M.nx.toFixed(2), +M.nz.toFixed(2), +M.free.toFixed(1), M.road, Math.round(b.h)); // (main front: QA poses)
        return { h: r.h, roof: !!r.roof, signed: !!b._signed };
    }

    /** build the archetype-atlas wall meshes (material = the city's facade shader with this atlas) */
    function finish(makeMaterial, closedShare) {
        const out = [];
        if (![...supers.values()].some(o => !o.mb.empty)) return out;
        const mat = makeMaterial(archetypeAtlas()); mat.name = 'archetype-facades';
        for (const o of supers.values()) {
            if (o.mb.empty) continue;
            const m = new MeshMaker(o.mb, mat); m.name = `arch-solid ${o.i},${o.j}`;
            m.userData.cx = (o.i + 0.5) * CELL * 2; m.userData.cz = (o.j + 0.5) * CELL * 2;
            if (closedShare) m.onBeforeRender = () => { try { mat.userData.uClosed.value = closedShare(); } catch { /* not ready */ } };
            stats.tris += o.mb.ic / 3; out.push(m);
        }
        stats.meshes = out.length; stats.tris = Math.round(stats.tris);
        return out;
    }
    return { match, emit, finish, stats };
}

let CYL = null; // unit cylinder (base at y = −0.5 … 0.5), prepared once
const cyl = () => CYL || (CYL = prep(new THREE.CylinderGeometry(1, 1, 1, 8)));
function MeshMaker(mb, mat) { const m = new THREE.Mesh(mb.build(), mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix(); return m; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mixRgb = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
