// ============================================================================
//  ARCHETYPE ATLAS — the 16-tile facade atlas of the archetype buildings (archetypes.js), drawn on a canvas
//  (split out of archetypes.js, spec 22)
// ============================================================================
import { makeCanvasTexture, makeRng } from './util.js';

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
