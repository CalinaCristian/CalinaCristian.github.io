// ============================================================================
//  Pike Place Market — each building's own front, on its OpenStreetMap footprint, as Street View shows it (Google
//  panoramas along Pike Place from 1504 to 1934 and at Pike St, viewed for reference only; nothing copied):
//   Corner Market      buff stucco, red brick-pattern panels, three-light windows and round-arched top windows, its
//                      name in red letters, open produce stalls under the canopy
//   Sanitary Market    cream, teal window frames under rust awnings, SANITARY PUBLIC MARKET in red across the top
//   Triangle Building  brick; the low half with an iron balcony on orange posts and blue awnings, the tall half plain
//   Garden Center      Beecher's one cream storey with its name across a deep fascia; cream blocks behind
//   Stewart House      brick, tall green-framed windows with small iron balconies, a green canopy over the shops
//   1912 Pike Place    one cream storey (the original Starbucks, Maíz), then the cream-and-green two- and
//   … Champion, Pike & Virginia   three-storey blocks with ribbon windows up to Virginia St
//   Economy Market, LaSalle, Leland Hotel   cream, dark or brown frames
//  1st Ave and upper Post Alley (panoramas along 1st Ave from Union St to Virginia St and along Post Alley from Pike Place
//  to Virginia St): the tan First & Pine block, the brick Inn at the Market with red shop awnings on the alley, the brick
//  blocks up to Virginia St (Fairmount, Alaska Trade with green frames and blue awnings, a pale terracotta front, Landes
//  Block), the grey clapboard house and the brick workshop front on the alley; across 1st Ave the brick Hahn Building,
//  the pale Broderick and S.J. Holmes buildings, the brick Palihotel with striped awnings and the Atwood. The alley sides
//  of the Pike Place blocks north of Stewart St are service walls (doors, a roll shutter), as they are.
//  Everything is geometry (windows with frames, sills and glazing bars, awnings, balconies, shopfronts) on tiled
//  brick / stucco walls; a third of the upper windows and every shopfront light up at night.
//  Heights are Street View estimates above the footprint's street level.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, rng, canvas, canvasTexture, inPoly, polyArea, lerp, fitDraw } from '../kit.js';
import { stall, signBoard } from '../props.js';
import { triangulate } from '../../building-overlap.js';
import { lowerWallKind } from './pike-place-lower.js';

const CREAM = '#e8dec3', BUFF = '#dcc7a6', BRICK = '#a2543f', GREEN = '#2f5a44', CANOPY = '#31463d';
const upper = (h, win, extra = {}) => ({ h, win, ...extra });
const rows = (n, h, win, extra = {}) => Array.from({ length: n }, () => upper(h, win, extra));
const SPECS = {
    w206858876: { name: 'Corner Market', h: 12.6, wall: BUFF, mat: 'stucco', bay: 4.7, cornice: '#cdb692',
        floors: [upper(3.9, { w: 2.9, h: 1.5, sill: 1.0, arch: true, cols: 3, rows: 2, frame: '#8a3a32' }, { panel: '#b4594a' }), upper(3.3, { w: 2.9, h: 1.7, sill: 0.9, cols: 3, rows: 2, frame: '#8a3a32' }, { panel: '#b4594a' })],
        ground: { kind: 'open', everywhere: true, posts: GREEN, shutter: '#8c8c86', stalls: ['produce', 'flowers', 'produce', 'fish'] }, lettering: { text: 'CORNER MARKET', color: '#9c3b2e', h: 0.8, fromTop: 4.2 } },
    w206858888: { name: 'Sanitary Public Market', h: 12.6, wall: CREAM, mat: 'stucco', bay: 4.4, cornice: '#d8cdb0',
        floors: [upper(1.3, null), upper(3.3, { w: 2.4, h: 1.6, sill: 1.0, cols: 3, rows: 2, frame: '#2f6f7a', awning: '#a4452f' })],
        ground: { kind: 'open', posts: '#f1ede2', shutter: '#8c8c86', stalls: ['fish', 'produce', 'produce', 'flowers'] }, lettering: { text: 'SANITARY PUBLIC MARKET', color: '#a23a2c', h: 0.85, fromTop: 1.15 } },
    w421508941: { name: 'Triangle Building (south)', h: 8.2, wall: BRICK, mat: 'brick', bay: 3.9,
        floors: [upper(3.4, { w: 1.3, h: 1.9, sill: 0.75, cols: 2, rows: 2, frame: '#e9e2d2', awning: '#2a4f8a' })],
        ground: { kind: 'shop', trim: '#e8e4da', bulk: '#2d5f9a' }, balcony: { depth: 1.35, rail: '#1e1e20', posts: '#c4622d' } },
    w231362205: { name: 'Triangle Building (north)', h: 11.6, wall: '#98503f', mat: 'brick', bay: 3.6,
        floors: [upper(3.3, { w: 1.25, h: 1.8, sill: 0.9, cols: 1, rows: 2, frame: '#3a3a3a' }), upper(3.3, { w: 1.25, h: 1.8, sill: 0.9, cols: 1, rows: 2, frame: '#3a3a3a' }, { ledge: true })],
        ground: { kind: 'open', posts: '#e9e2d2', shutter: '#c2643a', stalls: ['produce', 'flowers'] } },
    w396819738: { name: "Beecher's", h: 5.0, wall: '#ece4cf', mat: 'stucco', bay: 4.2, floors: [],
        ground: { kind: 'shop', trim: '#2a2a28', bulk: '#2a2a28', canopy: '#2b2d2c' }, lettering: { text: "BEECHER'S HANDMADE CHEESE", color: '#2b2b2b', h: 0.66, fromTop: 0.72, font: (s) => `600 ${s}px Georgia, "Times New Roman", serif` } },
    w396819732: { name: 'Garden Center Building', h: 8.0, wall: '#e6dfcf', mat: 'stucco', bay: 3.8, floors: [upper(3.2, { w: 2.6, h: 1.5, sill: 0.9, cols: 3, rows: 1, frame: '#2d3a36' })], ground: { kind: 'shop', trim: '#2d3a36', bulk: '#2d3a36', canopy: GREEN } },
    w396819725: { name: 'Garden Center Building', h: 5.0, wall: '#e6dfcf', mat: 'stucco', bay: 3.8, floors: [], ground: { kind: 'shop', trim: '#2d3a36', bulk: '#2d3a36', canopy: GREEN } },
    w396819729: { name: 'Garden Center Building', h: 5.0, wall: '#e6dfcf', mat: 'stucco', bay: 3.8, floors: [], ground: { kind: 'shop', trim: '#2d3a36', bulk: '#2d3a36', canopy: GREEN } },
    w367894552: { name: 'Stewart House', h: 12.0, wall: BRICK, mat: 'brick', bay: 4.2,
        floors: [upper(3.3, { w: 1.15, h: 2.0, sill: 0.4, cols: 1, rows: 2, frame: '#2f4a3c', juliet: true }), upper(3.3, { w: 1.15, h: 2.0, sill: 0.4, cols: 1, rows: 2, frame: '#2f4a3c', juliet: true })],
        ground: { kind: 'shop', trim: '#2f4a3c', bulk: '#2f4a3c', canopy: CANOPY } },
    w367894553: { name: '1912 Pike Place', h: 5.2, wall: CREAM, mat: 'stucco', bay: 4.4, floors: [], ground: { kind: 'shop', trim: '#4a2c1e', bulk: '#3f5a45', canopy: CANOPY } },
    w367894554: { name: 'Soames-Dunn Building', h: 8.4, wall: '#e2d6b8', mat: 'stucco', bay: 4.6, floors: [upper(3.3, { w: 3.4, h: 1.5, sill: 1.0, cols: 4, rows: 1, frame: '#2f4a3c' })], ground: { kind: 'shop', trim: '#2f4a3c', bulk: '#2f4a3c', canopy: CANOPY } },
    w367894555: { name: 'Champion Building', h: 11.8, wall: '#e9dcbc', mat: 'stucco', bay: 5.0,
        floors: [upper(3.3, { w: 3.6, h: 1.45, sill: 1.0, cols: 4, rows: 1, frame: '#2b2f2e' }), upper(3.3, { w: 3.6, h: 1.45, sill: 1.0, cols: 4, rows: 1, frame: '#2b2f2e' }, { band: '#3d6a55' })],
        ground: { kind: 'shop', trim: '#2b2f2e', bulk: '#3b3b38', canopy: CANOPY } },
    w367894556: { name: 'Pike & Virginia Building', h: 11.5, wall: '#d9d4c6', mat: 'stucco', bay: 5.2,
        floors: [upper(3.3, { w: 3.8, h: 1.6, sill: 0.9, cols: 4, rows: 1, frame: '#39423f' }, { planter: true }), upper(3.3, { w: 3.8, h: 1.6, sill: 0.9, cols: 4, rows: 1, frame: '#39423f' }, { planter: true })],
        ground: { kind: 'shop', trim: '#39423f', bulk: '#55594f', canopy: '#3f6a58' } },
    w363197067: { name: 'Economy Market', datum: 'max', h: 8.0, wall: '#e5dabd', mat: 'stucco', bay: 4.4, floors: [upper(3.1, { w: 3.0, h: 1.4, sill: 0.9, cols: 3, rows: 1, frame: '#2a2d2b' })], ground: { kind: 'shop', trim: '#2f4a3c', bulk: '#2f4a3c' } },
    w363197068: { name: 'LaSalle Hotel', datum: 'max', h: 11.2, wall: '#e9e1cc', mat: 'stucco', bay: 3.6,
        floors: [upper(3.2, { w: 1.2, h: 1.8, sill: 0.9, cols: 1, rows: 2, frame: '#5a4a3c' }), upper(3.2, { w: 1.2, h: 1.8, sill: 0.9, cols: 1, rows: 2, frame: '#5a4a3c' })], ground: { kind: 'shop', trim: '#3a332c', bulk: '#3a332c' } },
    // the Leland Hotel: its open market floor, roof and sign stay in pike-place.js; these are the storeys above it
    w1271653800: { name: 'Leland Hotel', datum: 'street', from: 3.9, h: 13.4, shell: false, wall: '#efe6cf', mat: 'stucco', bay: 3.3, cornice: '#d9cfb4',
        floors: [0, 1, 2].map(() => upper(3.0, { w: 1.25, h: 1.75, sill: 0.85, cols: 1, rows: 2, frame: '#7a4a35' })), ground: { kind: 'none' } },
};
// ---- 1st Ave and upper Post Alley: levels from the highest street beside the footprint (1st Ave), heights from OSM
Object.assign(SPECS, {
    w231362204: { name: 'First & Pine Building', datum: 'max', h: 17.5, wall: '#d8c9a8', mat: 'stucco', bay: 3.6, floors: rows(4, 3.3, { w: 1.5, h: 1.8, sill: 0.85, cols: 2, rows: 2, frame: '#ece6d6' }), ground: { kind: 'shop', trim: '#2e2e2c', bulk: '#2e2e2c', canopy: '#3a4a44' } },
    w396819739: { name: 'Inn at the Market', datum: 'max', h: 20.8, wall: '#9c5340', mat: 'brick', bay: 3.8, floors: rows(5, 3.1, { w: 1.7, h: 1.8, sill: 0.8, cols: 2, rows: 1, frame: '#2f3a36' }), ground: { kind: 'shop', trim: '#7a1f22', bulk: '#5a1a1c', awning: '#8f1d22' } },
    w396819735: { name: 'Inn at the Market', datum: 'max', h: 14.2, wall: '#9c5340', mat: 'brick', bay: 3.8, floors: rows(3, 3.1, { w: 1.7, h: 1.8, sill: 0.8, cols: 2, rows: 1, frame: '#2f3a36' }), ground: { kind: 'shop', trim: '#7a1f22', bulk: '#5a1a1c', awning: '#8f1d22' } },
    w396819733: { name: 'Inn at the Market', datum: 'max', h: 17.5, wall: '#9c5340', mat: 'brick', bay: 3.8, floors: rows(4, 3.1, { w: 1.7, h: 1.8, sill: 0.8, cols: 2, rows: 1, frame: '#2f3a36' }), ground: { kind: 'shop', trim: '#7a1f22', bulk: '#5a1a1c', awning: '#8f1d22' } },
    w360950564: { name: 'Fairmount Apartments', datum: 'max', h: 19, wall: '#7f4a3a', mat: 'brick', bay: 3.4, floors: rows(5, 3.0, { w: 1.3, h: 1.7, sill: 0.85, cols: 1, rows: 2, frame: '#d9d2c0' }), ground: { kind: 'shop', trim: '#1e1e1e', bulk: '#1e1e1e', awning: '#1c1c1c' } },
    w360950561: { name: 'Alaska Trade Building', datum: 'max', h: 17.5, wall: '#a4523d', mat: 'brick', bay: 4.2, floors: rows(4, 3.4, { w: 2.4, h: 2.0, sill: 0.8, cols: 3, rows: 2, frame: '#2f5a44' }), ground: { kind: 'shop', trim: '#2f5a44', bulk: '#2f5a44', awning: '#27457a' } },
    w360950559: { name: '1921 1st Ave', datum: 'max', h: 14, wall: '#e9e6dc', mat: 'stucco', bay: 3.2, cornice: '#f4f2ea', floors: rows(2, 3.6, { w: 1.5, h: 2.1, sill: 0.8, cols: 1, rows: 2, frame: '#3a3a38' }), ground: { kind: 'shop', trim: '#d9d5c8', bulk: '#bdb8aa' } },
    w360950557: { name: '1923 1st Ave', datum: 'max', h: 13.5, wall: '#a84f3c', mat: 'brick', bay: 3.6, floors: rows(3, 3.3, { w: 1.6, h: 1.9, sill: 0.8, cols: 2, rows: 2, frame: '#3a2f2a' }), ground: { kind: 'shop', trim: '#3a2f2a', bulk: '#3a2f2a' } },
    w360950554: { name: '1927 1st Ave', datum: 'max', h: 27.4, wall: '#8c4a3a', mat: 'brick', bay: 3.6, floors: rows(7, 3.3, { w: 1.5, h: 1.8, sill: 0.85, cols: 2, rows: 2, frame: '#2d2d2b' }), ground: { kind: 'shop', trim: '#2d2d2b', bulk: '#2d2d2b' } },
    w206877616: { name: 'Landes Block', datum: 'max', h: 17.5, wall: '#93503f', mat: 'brick', bay: 3.6, floors: rows(4, 3.4, { w: 1.6, h: 1.9, sill: 0.85, cols: 2, rows: 2, frame: '#e2dccb' }), ground: { kind: 'shop', trim: '#2a2a28', bulk: '#2a2a28', awning: '#7a1f22' } },
    w360950567: { name: 'Post Alley workshop front', datum: 'max', h: 8.6, wall: '#8f4d3c', mat: 'brick', bay: 4.4, floors: [upper(3.6, { w: 3.2, h: 2.2, sill: 0.7, cols: 5, rows: 3, frame: '#2a2a2a' })], ground: { kind: 'shop', trim: '#4a3526', bulk: '#4a3526' } },
    w231357663: { name: 'Post Alley clapboard house', datum: 'max', h: 9.6, wall: '#a3a8a6', mat: 'siding', bay: 3.4, floors: rows(3, 3.0, { w: 1.1, h: 1.8, sill: 0.6, cols: 1, rows: 2, frame: '#f0efe9', juliet: true }), ground: { kind: 'none' } },
    r5402577: { name: '1415 1st Ave', datum: 'max', h: 14.5, wall: '#bfb7a8', mat: 'stucco', bay: 4.0, floors: rows(3, 3.2, { w: 1.5, h: 1.7, sill: 0.9, cols: 2, rows: 1, frame: '#4a4a48' }), ground: { kind: 'shop', trim: '#2c2c2a', bulk: '#2c2c2a', canopy: '#2c2c2a' } },
    // across 1st Ave
    w397007179: { name: '1426 1st Ave', datum: 'max', h: 7.6, wall: '#8e8a84', mat: 'stucco', bay: 4.4, floors: [upper(3.0, { w: 2.6, h: 1.3, sill: 1.0, cols: 3, rows: 1, frame: '#2a2a2a' })], ground: { kind: 'shop', trim: '#222222', bulk: '#222222', awning: '#1f1f1f' } },
    w231361927: { name: 'Harold Poll Building', datum: 'max', h: 17.5, wall: '#8a4a3a', mat: 'brick', bay: 3.6, floors: rows(4, 3.4, { w: 1.5, h: 1.9, sill: 0.85, cols: 2, rows: 2, frame: '#d8d0bc' }), ground: { kind: 'shop', trim: '#2a2a28', bulk: '#2a2a28' } },
    w231361932: { name: 'Hahn Building', datum: 'max', h: 10.9, wall: '#a05a45', mat: 'brick', bay: 3.6, floors: rows(2, 3.3, { w: 1.4, h: 1.9, sill: 0.8, cols: 2, rows: 2, frame: '#e6dfcf' }), ground: { kind: 'shop', trim: '#1f3f2f', bulk: '#1f3f2f' } },
    w231361933: { name: 'Broderick Building', datum: 'max', h: 9, wall: '#e6e0d0', mat: 'stucco', bay: 4.2, cornice: '#f1ece0', floors: [upper(3.6, { w: 2.2, h: 2.0, sill: 0.8, cols: 2, rows: 2, frame: '#4a4038' })], ground: { kind: 'shop', trim: '#2a2622', bulk: '#2a2622' } },
    w357834361: { name: 'S.J. Holmes Building', datum: 'max', h: 8.5, wall: '#cfc5b0', mat: 'stucco', bay: 4.2, floors: [upper(3.4, { w: 2.2, h: 1.9, sill: 0.8, cols: 2, rows: 2, frame: '#3d3832' })], ground: { kind: 'shop', trim: '#2a2622', bulk: '#2a2622' } },
    w231361935: { name: 'Palihotel', datum: 'max', h: 14.2, wall: '#a35540', mat: 'brick', bay: 3.8, floors: rows(3, 3.3, { w: 1.5, h: 1.9, sill: 0.85, cols: 2, rows: 2, frame: '#2a2a2a' }), ground: { kind: 'shop', trim: '#f1ede2', bulk: '#2a2a2a', awning: 'stripe:#1c1c1c,#f1ede2' } },
    r5960590: { name: 'Atwood', datum: 'max', h: 20.8, wall: '#8f4b3b', mat: 'brick', bay: 3.6, floors: rows(5, 3.3, { w: 1.5, h: 1.8, sill: 0.85, cols: 2, rows: 2, frame: '#2d2d2b' }), ground: { kind: 'shop', trim: '#2d2d2b', bulk: '#2d2d2b' } },
});
for (const id of ['w367894553', 'w367894554', 'w367894555', 'w367894556']) SPECS[id].back = 'service'; // their Post Alley sides: doors and shutters, no shops;
// the alley is 6 m above Pike Place there, and Street View shows a blank wall about a storey and a half high on it
const PARENTS = ['w1190291980', 'w231360587', 'w409363106']; // Triangle Building, Garden Center Building, Inn at the Market: built from their parts above
export const FACADE_IDS = new Set(Object.keys(SPECS));
// mapped canopies (building=roof) over the Pike Place and Pike St sidewalks: Street View shows slim dark green canopies
// about 3.5 m up on thin posts, pale underneath; the generic slab stood a storey higher and hid the fronts
const CANOPIES = ['w368008771', 'w1275882971', 'w1275882973', 'w1275882974', 'w396819740', 'w363400648'];

export function prepareFacades(ctx) { for (const id of [...Object.keys(SPECS), ...PARENTS, ...CANOPIES]) if (id !== 'w1271653800') ctx.skipBuildings.add(id); }

// ---------------------------------------------------------------------------- wall textures (tinted by the wall colour)
function brickTile() {
    const S = 512, c = canvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), D = img.data, bw = 51, bh = 17; // 21.5 × 7.2 cm bricks on a 2.15 m tile
    for (let yy = 0; yy < S; yy++) { const row = Math.floor(yy / bh), my = yy % bh < 2;
        for (let xx = 0; xx < S; xx++) { const o = (yy * S + xx) * 4, bx = xx + (row % 2) * 25, mortar = my || bx % bw < 2, hs = Math.sin(Math.floor(bx / bw) * 127.1 + row * 311.7) * 43758.5453, t = hs - Math.floor(hs), n = (((xx * 12.9898 + yy * 78.233) * 43758.5453) % 1 + 1) % 1;
            const k = mortar ? 215 : 205 + 50 * t - 14 * n, w = mortar ? 1.12 : 1; D[o] = Math.min(255, k); D[o + 1] = Math.min(255, k * w); D[o + 2] = Math.min(255, k * w * 1.04); D[o + 3] = 255; } }
    x.putImageData(img, 0, 0); return canvasTexture(c, { repeat: true });
}
function stuccoTile() {
    const S = 256, c = canvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), D = img.data, r = rng(9);
    for (let i = 0; i < S * S; i++) { const k = 236 + r() * 19; D[i * 4] = k; D[i * 4 + 1] = k; D[i * 4 + 2] = k; D[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); x.fillStyle = 'rgba(70,60,45,0.05)'; for (let i = 0; i < 26; i++) x.fillRect(r() * S, r() * S, 2 + r() * 5, 20 + r() * 90); // weather streaks
    return canvasTexture(c, { repeat: true });
}
function sidingTile() {
    const S = 256, c = canvas(S, S), x = c.getContext('2d'); x.fillStyle = '#f2f2f2'; x.fillRect(0, 0, S, S); // 16 cm lap boards on a 1.6 m tile
    for (let i = 0; i < 10; i++) { const y = i * 25.6; x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, y, S, 2.5); x.fillStyle = 'rgba(0,0,0,0.06)'; x.fillRect(0, y + 2.5, S, 5); x.fillStyle = 'rgba(255,255,255,0.5)'; x.fillRect(0, y + 22, S, 3); }
    return canvasTexture(c, { repeat: true });
}
/** letters fixed to a wall (no board behind them) */
function wallLetters(text, w, h, color, font) {
    const ppm = 110, cw = Math.min(2048, Math.round(w * ppm)), ch = Math.round(h * ppm), c = canvas(cw, ch), x = c.getContext('2d');
    fitDraw(x, text, cw * 0.01, ch * 0.04, cw * 0.98, ch * 0.92, { font: font || ((s) => `900 ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`), color, maxLines: 1 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: canvasTexture(c), transparent: true, alphaTest: 0.35, roughness: 0.7 })); m.name = 'letters:' + text; return m;
}

/**
 * @param {{ at:(x,z)=>{d,y} }} street  Pike Place (levels + distance), for the footprints that take their level from it
 * @param {{ low?: Set<string> }} o  low: one-storey footprints (the market halls) that do not hide the storeys of a taller neighbour
 */
export function buildFacades(ctx, street, { low: lowIds = new Set() } = {}) {
    const g = ctx.ground, d = ctx.data, b = new GeoBatch(), grp = new THREE.Group(), r = rng(1907); grp.name = 'market-facades';
    const blockers = d.buildings.filter((o) => o.k !== 'roof' && !o.hasParts && o.poly?.length > 2), roofs = d.buildings.filter((o) => o.k === 'roof' && o.poly?.length > 2);
    const mats = {
        'pp-brick': new THREE.MeshStandardMaterial({ map: brickTile(), vertexColors: true, roughness: 0.92 }), 'pp-stucco': new THREE.MeshStandardMaterial({ map: stuccoTile(), vertexColors: true, roughness: 0.95 }), 'pp-siding': new THREE.MeshStandardMaterial({ map: sidingTile(), vertexColors: true, roughness: 0.8 }),
        'pp-win': new THREE.MeshStandardMaterial({ color: '#1d262d', roughness: 0.12, metalness: 0.65 }),
        'pp-display': Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: new THREE.Color('#5a4630'), emissiveIntensity: 0.15 }), { userData: { dayGlow: 0.15, nightGlow: 0.9 } }),
        'pp-winlit': Object.assign(new THREE.MeshStandardMaterial({ color: '#2a2a26', roughness: 0.3, emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 }), { userData: { dayGlow: 0, nightGlow: 1.15 } }),
        'pp-shop': Object.assign(new THREE.MeshStandardMaterial({ color: '#2b3236', roughness: 0.1, metalness: 0.55, emissive: new THREE.Color('#ffdca6'), emissiveIntensity: 0.045 }), { userData: { dayGlow: 0.045, nightGlow: 1.25 } }), // a lit shop behind the glass
    };
    const stats = { buildings: 0, fronts: 0, windows: 0, shopBays: 0, stalls: 0 }, letters = [];
    for (const src of d.buildings) {
        const S = SPECS[src.id]; if (!S) continue;
        const poly = polyArea(src.poly) > 0 ? src.poly : [...src.poly].reverse(), n = poly.length, key = 'pp-' + S.mat;
        const faces = poly.map((A, i) => { const B = poly[(i + 1) % n], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1e-6, ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L; let nx = uz, nz = -ux;
            if (inPoly((A[0] + B[0]) / 2 + nx * 0.4, (A[1] + B[1]) / 2 + nz * 0.4, poly)) { nx = -nx; nz = -nz; }
            const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2, clear = (o) => !blockers.some((q) => q !== src && !(S.from != null && lowIds.has(q.id)) && inPoly(mx + nx * o, mz + nz * o, q.poly));
            const lower = lowerWallKind(mx, mz), gAt = (x, z) => (lower === 'econ' ? g.floorAt?.(x, z) : null) ?? g.heightAt(x, z); // (the lower level: pike-place-lower.js)
            return { A, B, L, ux, uz, nx, nz, mx, mz, lower, yaw: Math.atan2(nx, nz), front: L >= 2.2 && clear(0.9) && clear(2.4), gA: gAt(A[0] + nx * 0.8, A[1] + nz * 0.8), gB: gAt(B[0] + nx * 0.8, B[1] + nz * 0.8), sd: street.at(mx, mz).d, toStreet: (() => { const q = street.at(mx, mz); return ((q.cx - mx) * nx + (q.cz - mz) * nz) / (q.d || 1); })() }; });
        const fronts = faces.filter((f) => f.front), main = [...(fronts.length ? fronts : faces)].sort((p, q) => p.sd - q.sd)[0];
        const datum = S.datum === 'max' ? Math.max(...faces.map((f) => Math.max(f.gA, f.gB))) : S.datum === 'street' ? Math.max(...poly.map(([x, z]) => street.at(x, z).y)) : Math.max(main.gA, main.gB);
        const roofY = datum + S.h, low = Math.min(...faces.map((f) => Math.min(f.gA, f.gB))) - 1.2, parapet = 0.5, from = S.from != null ? datum + S.from : null;
        stats.buildings++;
        for (const f of faces) {
            if (f.L < 0.15) continue;
            const y0 = from ?? Math.min(f.gA, f.gB, low + 1.2) - 0.6, T = S.mat === 'siding' ? 1.6 : 2.15, service = S.back === 'service' && f.sd > 22, wallTop = service ? Math.max(roofY, Math.max(f.gA, f.gB) + 4.8) : roofY;
            b.quad([f.B[0], y0, f.B[1]], [f.A[0], y0, f.A[1]], [f.A[0], wallTop, f.A[1]], [f.B[0], wallTop, f.B[1]], S.wall, key, [f.L / T, y0 / T, 0, y0 / T, 0, wallTop / T, f.L / T, wallTop / T]);
            if (wallTop > roofY + 0.05) b.quad([f.A[0], roofY, f.A[1]], [f.B[0], roofY, f.B[1]], [f.B[0], wallTop, f.B[1]], [f.A[0], wallTop, f.A[1]], S.wall, key, [0, roofY / T, f.L / T, roofY / T, f.L / T, wallTop / T, 0, wallTop / T]); // (its back, seen over the roof)
            if (!f.front) continue;
            stats.fronts++;
            const at = (u, y, out = 0) => [f.A[0] + f.ux * u + f.nx * out, y, f.A[1] + f.uz * u + f.nz * out], box = (u, y, out, w, h, dp, col, k = 'paint') => { const [x, , z] = at(u, y, out); b.box(x, y, z, w, h, dp, col, k, f.yaw); };
            const nb = Math.max(1, Math.round(f.L / S.bay)), bw = f.L / nb, gnd = (u) => lerp(f.gA, f.gB, u / f.L), lined = /^(gum|alley|alleyGum|under|espresso|door)$/.test(f.lower || '');
            box(f.L / 2, wallTop - 0.28, 0.1, f.L + 0.3, 0.3, 0.4, S.cornice || S.wall);                                 // cornice
            // upper storeys, hung from the roof line
            let yTop = roofY - parapet;
            // on a side where the ground is a storey or more lower (an alley behind a 1st Ave front) the windows carry on down
            const stack = [...S.floors]; { const lastWin = [...S.floors].reverse().find((F) => F.win); let rem = yTop - stack.reduce((a, F) => a + F.h, 0) - Math.max(f.gA, f.gB); while (S.from == null && lastWin && rem > 6.6) { stack.push(upper(lastWin.h, lastWin.win)); rem -= lastWin.h; } }
            stack.forEach((F, fi) => {
                const yF = yTop - F.h; yTop = yF;
                if (F.band) box(f.L / 2, yF + F.h - 0.34, 0.04, f.L, 0.5, 0.1, F.band);
                if (!F.win || wallTop > roofY + 0.05) return;
                const W = F.win, ww = Math.min(W.w, bw - 0.7); if (ww < 0.7) return;
                for (let k = 0; k < nb; k++) {
                    const u = (k + 0.5) * bw, ys = yF + W.sill, key2 = r() < 0.32 ? 'pp-winlit' : 'pp-win'; if (ys < gnd(u) + 0.45 || (lined && ys < 3.7)) continue; stats.windows++;
                    box(u, ys, 0.03, ww, W.h, 0.06, '#ffffff', key2);
                    if (W.arch) { const [x, , z] = at(u, 0, 0.02); b.cyl(x, ys + W.h, z, ww / 2 + 0.09, 0.03, W.frame, 'paint', 18, 1, Math.PI / 2, f.yaw, 0); const [x2, , z2] = at(u, 0, 0.045); b.cyl(x2, ys + W.h, z2, ww / 2, 0.03, '#ffffff', key2, 18, 1, Math.PI / 2, f.yaw, 0); box(u, ys + W.h - 0.04, 0.06, ww, 0.08, 0.08, W.frame); }
                    for (const s of [-1, 1]) box(u + s * (ww / 2 + 0.035), ys - 0.04, 0.06, 0.09, W.h + 0.12, 0.12, W.frame);                    // jambs
                    if (!W.arch) box(u, ys + W.h, 0.06, ww + 0.16, 0.09, 0.12, W.frame); box(u, ys - 0.09, 0.09, ww + 0.3, 0.09, 0.2, '#d9d2c0');    // head, sill
                    for (let q = 1; q < (W.cols || 1); q++) box(u - ww / 2 + ww * q / W.cols, ys, 0.07, 0.05, W.h, 0.05, W.frame);
                    for (let q = 1; q < (W.rows || 1); q++) box(u, ys + W.h * q / W.rows - 0.025, 0.07, ww, 0.05, 0.05, W.frame);
                    if (F.panel) { box(u, yF + 0.12, 0.03, ww + 0.1, Math.max(0.35, W.sill - 0.32), 0.05, F.panel); box(u, yF + 0.22, 0.05, (ww + 0.1) * 0.5, Math.max(0.15, W.sill - 0.52), 0.04, '#d8b9a0'); } // brick-pattern panel under the window
                    if (W.awning) { const a = at(u - ww / 2 - 0.15, ys + W.h + 0.2, 0.05), c2 = at(u + ww / 2 + 0.15, ys + W.h + 0.2, 0.05), a2 = at(u - ww / 2 - 0.15, ys + W.h - 0.38, 0.8), c3 = at(u + ww / 2 + 0.15, ys + W.h - 0.38, 0.8); b.quad(c2, a, a2, c3, W.awning, 'fabric'); b.quad(a, c2, c3, a2, W.awning, 'fabric'); }
                    if (W.juliet) { for (const yy of [ys + 0.02, ys + 0.95]) box(u, yy, 0.36, ww + 0.36, 0.045, 0.045, '#1e1e20', 'metal'); for (let q = 0; q <= 6; q++) box(u - (ww + 0.3) / 2 + (ww + 0.3) * q / 6, ys + 0.02, 0.36, 0.025, 0.95, 0.025, '#1e1e20', 'metal'); for (const s of [-1, 1]) box(u + s * (ww / 2 + 0.17), ys + 0.95, 0.19, 0.045, 0.045, 0.36, '#1e1e20', 'metal'); box(u, ys - 0.06, 0.2, ww + 0.4, 0.07, 0.4, '#8f8a82', 'concrete'); }
                    if (F.planter) { box(u, ys - 0.5, 0.3, ww + 0.5, 0.42, 0.6, '#c9c4b6', 'concrete'); box(u, ys - 0.1, 0.3, ww + 0.3, 0.3, 0.46, '#3f7a3a', 'plant'); }
                }
                if (F.ledge) { box(f.L / 2, yF - 0.12, 0.3, f.L, 0.12, 0.6, '#b9b3a6', 'concrete'); for (let k = 0; k < nb; k += 2) { const [x, , z] = at((k + 0.5) * bw, 0, 0.3); b.cyl(x, yF, z, 0.3, 0.9, '#2f5d3a', 'plant', 7, 0.05); } }
                if (fi === S.floors.length - 1 && S.balcony) { // an iron balcony across the storey, on posts at the kerb
                    const B2 = S.balcony; box(f.L / 2, yF - 0.02, B2.depth / 2, f.L, 0.16, B2.depth, '#6b655c', 'concrete');
                    for (const yy of [yF + 0.2, yF + 1.05]) box(f.L / 2, yy, B2.depth - 0.05, f.L, 0.05, 0.05, B2.rail, 'metal');
                    for (let q = 0, m = Math.max(2, Math.round(f.L / 0.45)); q <= m; q++) box(f.L * q / m, yF + 0.14, B2.depth - 0.05, 0.03, 0.93, 0.03, B2.rail, 'metal');
                    for (let k = 0; k <= nb; k++) { const u = Math.min(f.L - 0.1, Math.max(0.1, k * bw)), [x, , z] = at(u, 0, B2.depth - 0.12), yg = g.heightAt(x, z); b.box(x, yg, z, 0.17, yF - yg, 0.17, B2.posts, 'paint', f.yaw); ctx.circle(x, z, 0.12, 3, { y: yg }); }
                }
            });
            // the street storey
            // away from Pike Place a market building's open stall front is an ordinary shop front (Street View: Post Alley, 1st Ave)
            const G = lined ? { kind: 'none' } : service ? { kind: 'service' } : S.ground.kind === 'open' && !S.ground.everywhere && !(f.sd <= 11 && f.toStreet > 0.6) ? { kind: 'shop', trim: S.ground.posts, bulk: '#3a3a36' } : S.ground, coveredAt = (u) => roofs.some((q) => [0.5, 1.2, 2.0].some((o) => inPoly(f.A[0] + f.ux * u + f.nx * o, f.A[1] + f.uz * u + f.nz * o, q.poly))); // a mapped canopy already stands there
            for (let k = 0; k < nb && G.kind !== 'none'; k++) {
                const u = (k + 0.5) * bw, y = gnd(u), room = yTop - y; if (room < 2.4) continue;
                if (G.kind === 'shop') { stats.shopBays++;
                    const door = k % 3 === 1 && bw > 2.6, gw = bw - 0.55;
                    box(u - bw / 2 + 0.01, y, 0.05, 0.42, 2.9, 0.18, G.trim); if (k === nb - 1) box(u + bw / 2 - 0.01, y, 0.05, 0.42, 2.9, 0.18, G.trim);          // piers
                    box(u, y, 0.05, gw, 0.5, 0.12, G.bulk || G.trim); box(u, y + 0.5, 0.02, gw, 2.12, 0.06, '#ffffff', 'pp-shop');
                    for (let q = 0; q < 3; q++) { const du = (q - 1) * gw * 0.3 + (r() - 0.5) * 0.2, hh = 0.35 + r() * 0.75; box(u + du, y + 0.56, 0.09, gw * 0.2, hh, 0.02, ['#c9a36a', '#a8683f', '#d8c9a3', '#7f9a78', '#b9574a', '#e3d2ae'][Math.floor(r() * 6)], 'pp-display'); } // goods in the window                                    // bulkhead, glass
                    box(u, y + 2.05, 0.06, gw, 0.07, 0.1, G.trim); box(u, y + 2.62, 0.05, bw, 0.28, 0.14, G.trim); box(u, y + 0.5, 0.06, 0.07, 2.12, 0.1, G.trim);    // transom, head, mullion
                    if (door) { box(u + gw / 4, y, 0.07, 0.98, 2.05, 0.09, G.trim); box(u + gw / 4, y + 0.9, 0.15, 0.62, 1.0, 0.03, '#ffffff', 'pp-shop'); box(u + gw / 4 + 0.36, y + 1.0, 0.13, 0.04, 0.22, 0.05, '#c9b27a', 'metal'); }
                    if (G.awning && !G.canopy) { const [c1, c2] = G.awning.startsWith('stripe:') ? G.awning.slice(7).split(',') : [G.awning, G.awning], ns = Math.max(2, Math.round(gw / 0.5)); // a canvas awning over the shop window
                        for (let q = 0; q < ns; q++) { const u0 = u - gw / 2 + gw * q / ns, u1 = u - gw / 2 + gw * (q + 1) / ns, col = q % 2 ? c2 : c1, a = at(u0, y + 2.95, 0.12), c = at(u1, y + 2.95, 0.12), a2 = at(u0, y + 2.4, 1.15), c3 = at(u1, y + 2.4, 1.15); b.quad(c, a, a2, c3, col, 'fabric'); b.quad(a, c, c3, a2, col, 'fabric'); b.quad(c3, a2, at(u0, y + 2.22, 1.15), at(u1, y + 2.22, 1.15), col, 'fabric'); } }
                } else if (G.kind === 'service') { // an alley side: a steel door, now and then a roll shutter
                    if (k % 3 === 1) { box(u, y, 0.04, 1.0, 2.1, 0.07, '#4a4f4c', 'metal'); box(u, y + 2.1, 0.04, 1.16, 0.09, 0.09, '#3a3d3b'); } else if (k % 4 === 2 && bw > 3) { box(u, y, 0.04, bw - 1.0, 2.7, 0.06, '#8c8c86', 'metal'); for (let q = 1; q < 9; q++) box(u, y + q * 0.3, 0.08, bw - 1.0, 0.03, 0.02, '#6f6f69', 'metal'); }
                } else if (G.kind === 'open') {
                    box(u, y, 0.03, bw, Math.min(3.25, room - 0.2), 0.05, '#1b1815');                                                                                   // the market hall behind the stalls
                    box(u - bw / 2 + 0.01, y, 0.14, 0.22, 3.3, 0.22, G.posts); if (k === nb - 1) box(u + bw / 2 - 0.01, y, 0.14, 0.22, 3.3, 0.22, G.posts);
                    if (k % 3 === 2) { box(u, y, 0.07, bw - 0.4, 3.0, 0.06, G.shutter, 'metal'); for (let q = 1; q < 10; q++) box(u, y + q * 0.3, 0.11, bw - 0.4, 0.03, 0.02, '#6f6f69', 'metal'); }
                    else if (bw > 3.0 && G.stalls) { const [x, , z] = at(u, 0, 1.0), ys = g.heightAt(x, z), w = Math.min(3.3, bw - 0.7); stall(b, x, ys, z, f.yaw, { w, kind: G.stalls[stats.stalls % G.stalls.length], seed: 40 + stats.stalls }); ctx.box(x, z, w / 2, 0.6, f.yaw, { prop: true, h: 0.85 }); stats.stalls++; }
                }
                if (G.canopy && !coveredAt(u) && !coveredAt(u - bw * 0.4) && !coveredAt(u + bw * 0.4)) { box(u, y + 3.32, 1.2, bw + 0.02, 0.14, 2.4, G.canopy); box(u, y + 3.2, 2.36, bw + 0.02, 0.3, 0.08, G.canopy); if (k % 2 === 0) { const p = at(u, y + 3.46, 2.2), q = at(u, y + 4.5, 0.05); b.rod(p, q, 0.02, '#2a2d2c', 'metal', 5); } }
            }
            if (S.lettering && (f === main || f.L > S.lettering.text.length * S.lettering.h * 0.74 + 2.5)) letters.push({ S, f, roofY });
        }
        if (S.shell !== false) { b.flat(poly, roofY - 0.06, S.roof || '#6e6a64', 'roofs'); ctx.poly(poly, { y0: low - 2, y1: roofY }); }
    }
    // the sidewalk canopies, following the street's fall
    for (const src of d.buildings) {
        if (!CANOPIES.includes(src.id)) continue;
        const poly = src.poly, yAt = (x, z) => g.heightAt(x, z) + 3.55, T = 0.14, ring = [...poly, poly[0]];
        for (const tri of triangulate(poly) || []) { const v = tri.map(([x, z]) => [x, yAt(x, z) + T, z]), w = tri.map(([x, z]) => [x, yAt(x, z), z]); const up = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]) > 0;
            const [p, q, t2] = up ? v : [v[0], v[2], v[1]], [p2, q2, t3] = up ? [w[0], w[2], w[1]] : w; b.quad(p, q, t2, t2, '#2f4a3c', 'paint'); b.quad(p2, q2, t3, t3, '#cdd2c6', 'paint'); }
        let since = 3;
        for (let i = 0; i < poly.length; i++) { const A = ring[i], B = ring[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 0.05) continue;
            const ya = yAt(A[0], A[1]), yb = yAt(B[0], B[1]), mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2;
            const atWall = blockers.some((q) => inPoly(mx, mz, q.poly) || q.poly.some((P, k) => { const Q = q.poly[(k + 1) % q.poly.length], dx = Q[0] - P[0], dz = Q[1] - P[1], t = Math.max(0, Math.min(1, ((mx - P[0]) * dx + (mz - P[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(mx - P[0] - dx * t, mz - P[1] - dz * t) < 0.5; }));
            if (!atWall) b.quad([A[0], ya - 0.2, A[1]], [B[0], yb - 0.2, B[1]], [B[0], yb + T, B[1]], [A[0], ya + T, A[1]], '#2a4236', 'paint'); if (!atWall) b.quad([B[0], yb - 0.2, B[1]], [A[0], ya - 0.2, A[1]], [A[0], ya + T, A[1]], [B[0], yb + T, B[1]], '#2a4236', 'paint'); // fascia
            for (let u = Math.max(0, 5 - since); u < L; u += 5) { const x = A[0] + (B[0] - A[0]) * u / L, z = A[1] + (B[1] - A[1]) * u / L; since = -u;
                if (blockers.some((q) => inPoly(x, z, q.poly) || q.poly.some((P, k) => { const Q = q.poly[(k + 1) % q.poly.length], dx = Q[0] - P[0], dz = Q[1] - P[1], t = Math.max(0, Math.min(1, ((x - P[0]) * dx + (z - P[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - P[0] - dx * t, z - P[1] - dz * t) < 0.9; }))) continue; // hung from the wall there
                const y0 = g.heightAt(x, z); b.cyl(x, y0, z, 0.07, 3.55, '#2f4a3c', 'paint', 8); ctx.circle(x, z, 0.1, 3.5, { y: y0 }); stats.posts = (stats.posts || 0) + 1; }
            since += L; }
        { const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length, cz = poly.reduce((a, p) => a + p[1], 0) / poly.length; if (inPoly(cx, cz, poly)) ctx.lampPoints.push({ x: cx, z: cz, y: g.heightAt(cx, cz), h: 3.2, noPost: true }); }
    }
    // the POST ALLEY sign over the alley's mouth at Pine St (Street View: a teal banner between the two buildings)
    { const x = -117.4, z = -60.8, dx = -0.545, dz = -0.839, y = g.heightAt(x, z) + 4.5;
        for (const s of [1, -1]) { const m = signBoard('POST ALLEY', 4.6, 0.85, { bg: '#3aa39c', fg: '#f4f1e6', depth: 0.04, font: (q) => `800 ${q}px "Trebuchet MS", "Helvetica Neue", Arial, sans-serif`, glow: 0.08, night: 1.0 }); m.position.set(x + dx * 0.03 * s, y, z + dz * 0.03 * s); m.rotation.y = Math.atan2(dx * s, dz * s); grp.add(m); }
        for (const s of [-1, 1]) b.rod([x - dz * 2.3 * s, y + 0.2, z + dx * 2.3 * s], [x - dz * 3.1 * s, y + 0.6, z + dx * 3.1 * s], 0.02, '#2a2d2c', 'metal', 5); }
    for (const { S, f, roofY } of letters) { const L = S.lettering, w = Math.min(f.L - 1.2, L.text.length * L.h * 0.74), m = wallLetters(L.text, w, L.h, L.color, L.font);
        m.position.set(f.mx + f.nx * 0.07, roofY - L.fromTop, f.mz + f.nz * 0.07); m.rotation.y = f.yaw; grp.add(m); }
    const built = b.build('market-facades', { matOverrides: mats }); for (const m of Object.values(mats)) m.name = 'pike-' + (m.map ? 'wall' : 'glazing');
    grp.add(built); ctx.add(grp); ctx.extras.facades = stats;
    return stats;
}
