// ============================================================================
//  Pike Place Market — every mapped business gets its sign where it really is.
//  Source: OpenStreetMap (the spot extract of 2026-11-06, checked against the live database on 2026-11-12: one
//  shop gone, the ones below added). Each business is put on the building that holds it, on the wall nearest to its
//  mapped position that faces open ground (its own frontage: Pike Place, Post Alley, 1st Ave, a side street…), at
//  its own place along that wall and on its own floor (`level`). Signs on one wall never overlap: they slide
//  along it, narrow, and as a last resort stack in a second row; none is dropped. Closed businesses (`disused:*`
//  with nothing else) get no sign.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, inPoly, distSeg, clamp, hash2 } from '../kit.js';
import { signAtlas } from './sea-common.js';

// in the live OSM database on 2026-11-12, not in the extract, on a block this scene models: [name, x, z, kind, level]
const ADDED = [
    ['Pufftown Bakehouse', -238.5, -146.4, 'shop', 0], ['Boon Boona Coffee', -209.1, 15, 'cafe', 0], ['Le Pichet', -202.1, -204.3, 'restaurant', 0], ['Virginia Inn', -207.5, -209.9, 'restaurant', 0],
    ["Maggie's Shoes", -186.5, -195.9, 'shop', 0], 
    ['Happy Days & Funny Nights', -229.5, -227, 'shop', 0], 
    
    ['Musubi Kai', 74.8, 99.6, 'restaurant', 0], ['Japonessa', 62.6, 102.1, 'restaurant', 0], ['Vetri', 58.3, 96.1, 'shop', 0],
    ['Myano Nails & Spa', 97.9, -144.2, 'shop', 0], ['Pho 25', 91.1, -153.9, 'restaurant', 0], 
    ['Simple Life', 25, -143.8, 'shop', 0], ['John Fluevog Shoes', 36, -150.5, 'shop', 0], ["Fran's Chocolates", 50.7, 148.3, 'shop', 0], 
    ['Fonté Coffee', 63.7, 170, 'cafe', 0], ['Traver Gallery', 80.1, 97.4, 'shop', 2],
    ['Goldfinch Tavern', 44.9, 151.8, 'restaurant', 0], 
    ['Sugo', -332.9, -184.6, 'restaurant', 0], ['Moore Coffee Seattle', -83.2, -200.6, 'cafe', 0],
    ['Seleušs Chocolates', -134.7, -191.5, 'shop', 0], ['Seattle Aquarium Cafe', -202.1, 183, 'restaurant', 2], ['Fossil & Stone', 9.5, -167.9, 'shop', 0], ['CVS Pharmacy', 73.7, 42.9, 'pharmacy', 0],
    ['Starbucks', 94.7, 78.5, 'cafe', 0], ['Karoo', -171.5, -181.4, 'bar', 0], 
    ['Thompson Seattle', -109.6, -184, 'hotel', 0], ['Four Seasons Seattle', 53, 176.7, 'hotel', 0],
    ['Seattle Antiques Market', -81.1, 168.1, 'shop', 0], ['Aerlume', -366.9, -185.4, 'restaurant', 0],
];
const GONE = new Set(['n2169065769']); // Subway, 106 Pike St: deleted from OSM
const FOOD = /^(restaurant|cafe|fast_food|bar|pub|ice_cream)$/, OTHER = /^(theatre|bank|pharmacy|post_office|car_rental)$/, STAY = /^(hotel|hostel|gallery|guest_house)$/;

/** the businesses of the extract + the live additions, as { id, name, x, z, kind, level } */
export function businesses(data) {
    const out = [];
    for (const p of data.pois || []) {
        if (!p.name || GONE.has(p.id)) continue;
        const kind = p.shop ? 'shop' : FOOD.test(p.amenity || '') || OTHER.test(p.amenity || '') ? p.amenity : p.craft ? 'craft' : STAY.test(p.tourism || '') ? p.tourism : p.healthcare ? 'health' : null;
        if (!kind) continue; // closed (`disused:*` only), artworks, offices, bus stops…
        out.push({ id: p.id, name: p.name, x: p.x, z: p.z, kind, level: parseFloat(p.level) || 0 });
    }
    ADDED.forEach(([name, x, z, kind, level], i) => out.push({ id: 'live' + i, name, x, z, kind, level }));
    return out;
}

const PAL = { food: [['#5a1e1e', '#f6efe0'], ['#f2e8cf', '#5a1e1e'], ['#2b2b2b', '#f5e6b0'], ['#7a2e1d', '#ffe9c4']], cafe: [['#3b2a20', '#f1e3c8'], ['#f1e7d2', '#3b2a20']], shop: [['#1f3d2b', '#f2e9d0'], ['#14213d', '#fca311'], ['#2b2b2b', '#f5f5f5'], ['#f2e8cf', '#3a2a1a'], ['#0b4f6c', '#f5f5f5'], ['#4a2545', '#f4e9f2']], stay: [['#1d2a2a', '#f3efe2'], ['#22303f', '#e9d8a6']] };
// Sign boards are not all alike: lettering style by a hash of the name, and for the best-known names colours close to the
// real boards (from Street View and memory of the place; colours only, no logo is drawn)
const FONTS = [[(q) => `700 ${q}px Georgia, serif`, false], [(q) => `800 ${q}px "Helvetica Neue", Arial, sans-serif`, true], [(q) => `italic 700 ${q}px Georgia, "Times New Roman", serif`, false],
    [(q) => `700 ${q}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`, true], [(q) => `600 ${q}px "Trebuchet MS", Verdana, sans-serif`, false], [(q) => `900 ${q}px Impact, "Arial Black", sans-serif`, true]];
const BRANDS = [
    [/^Le Panier/, '#23407a', '#f4efe2', 2], [/^Piroshky/, '#f4f1e8', '#c1272d', 1], [/^Pike Place Chowder/, '#1b4f8f', '#ffffff', 1], [/^Rachel's Ginger Beer/, '#f6f1ea', '#e2578d', 4],
    [/^Sur La Table/, '#f5f1e8', '#7a1c2e', 0], [/^Three Girls Bakery/, '#f6f2e6', '#b3202a', 0], [/^DeLaurenti/, '#1f4d2b', '#f5e9c8', 0], [/^Metsker Maps/, '#12305a', '#f2c230', 3],
    [/^Left Bank Book/, '#b3202a', '#141414', 5], [/^Totem Smokehouse/, '#3a1f14', '#f1c27d', 0], [/^Mee Sum Pastry/, '#b3202a', '#ffe89a', 1], [/^Jack's Fish Spot/, '#0f5fa8', '#ffffff', 5],
    [/^Pure Food Fish/, '#f4f1e8', '#1d4f91', 1], [/^Mr\. D's/, '#16243f', '#d9b24c', 3], [/^Cinnamon Works/, '#5a2d16', '#f3dfb9', 2], [/^The Crumpet Shop/, '#f1e7cf', '#5a3a22', 0],
    [/^Hellenika/, '#f7f4ec', '#1b6a7a', 4], [/^Emmett Watson/, '#1f2f4a', '#f1e6c9', 0], [/^Kells/, '#0f4a2c', '#e7c558', 0], [/^The Pink Door/, '#e99ab6', '#ffffff', 2], [/^Storyville/, '#2a2420', '#e9dcc3', 3],
    [/^Cupcake Royale/, '#e85a8f', '#ffffff', 4], [/^Starbucks/, '#00704a', '#ffffff', 1], [/^Target/, '#cc0000', '#ffffff', 1], [/^CVS/, '#cc0000', '#ffffff', 1], [/^Market Theater/, '#1b1b1d', '#f4f1e6', 3],
    [/^Lowell's/, '#1c3f6e', '#f4e7c3', 2], [/^The Athenian/, '#7a1f1f', '#f3e3b8', 0], [/^Pike Place Bar/, '#7a2e1d', '#ffe9c4', 0], [/^Matt's in the Market/, '#f3efe4', '#2b2b2b', 4], [/^Maximilien/, '#1d2d50', '#f0e2b6', 2],
    [/^Beecher/, '#ece4cf', '#2b2b2b', 0], [/^Ma[ií]z/, '#f2e8cf', '#2f2a26', 5], [/^Old Stove/, '#1e1e1e', '#f29b38', 5], [/^Inn at the Market/, '#22303f', '#e9d8a6', 0], [/^Zig Zag/, '#141414', '#e7c558', 2],
];
const signStyle = (biz, pal) => { const hit = BRANDS.find(([re]) => re.test(biz.name)), k = Math.floor(hash2(biz.x * 3.1 + biz.name.length, biz.z * 1.7) * 997) % FONTS.length, [font, caps] = FONTS[hit ? hit[3] : k];
    let text = biz.name.replace(/\s+-\s+.*$/, ''); if (caps) text = text.toUpperCase();
    return { text, font, bg: hit ? hit[1] : pal[0], fg: hit ? hit[2] : pal[1], h: hit ? 0.56 : 0.44 + 0.04 * (k % 4) }; };
const palette = (b) => { const set = b.kind === 'cafe' ? PAL.cafe : FOOD.test(b.kind) ? PAL.food : STAY.test(b.kind) ? PAL.stay : PAL.shop; return set[Math.floor(hash2(b.x, b.z) * set.length) % set.length]; };

/**
 * @param {{ list?: {id,name,x,z,kind,level}[], skip?: (b)=>boolean, groundAt?: (x,z)=>number, awning?: (wall)=>string|null }} o  skip: businesses a scene builds itself
 *   (a hero storefront); awning: 'stripe', a colour or null for the canvas awning under a ground-floor sign on that wall
 * @returns {{ total, signs, rows }} rows: every business with the wall and level it went to (ctx.extras.shops)
 */
export function buildShopSigns(ctx, o = {}) {
    const d = ctx.data, g = ctx.ground, bldgs = d.buildings.filter((b) => b.k !== 'roof' && !b.part && b.poly?.length > 2), walls = new Map(), rows = [];
    const inAny = (x, z, not) => bldgs.some((b) => b !== not && inPoly(x, z, b.poly)) || inPoly(x, z, not.poly);
    const yAt = o.groundAt || ((x, z) => g.floorAt?.(x, z) ?? g.heightAt(x, z));
    for (const biz of o.list || businesses(d)) { // o.list: another scene's own businesses (waterfront, pioneer-square)
        if (o.skip?.(biz)) { rows.push({ name: biz.name, hero: true }); continue; }
        let host = bldgs.find((b) => inPoly(biz.x, biz.z, b.poly));
        if (!host) { let best = 10; for (const b of bldgs) for (let i = 0; i < b.poly.length; i++) { const q = b.poly[i], w = b.poly[(i + 1) % b.poly.length], dd = distSeg(biz.x, biz.z, q[0], q[1], w[0], w[1]).d; if (dd < best) { best = dd; host = b; } } }
        if (!host) { rows.push({ name: biz.name, placed: false, why: 'no building within 10 m' }); continue; }
        // the wall of its building nearest to the mapped point that has open ground in front
        let pick = null;
        for (let i = 0; i < host.poly.length; i++) {
            const [ax, az] = host.poly[i], [bx, bz] = host.poly[(i + 1) % host.poly.length], L = Math.hypot(bx - ax, bz - az); if (L < 1.6) continue;
            const r = distSeg(biz.x, biz.z, ax, az, bx, bz), ux = (bx - ax) / L, uz = (bz - az) / L; let nx = uz, nz = -ux;
            if (inPoly((ax + bx) / 2 + nx * 0.4, (az + bz) / 2 + nz * 0.4, host.poly)) { nx = -nx; nz = -nz; }
            const open = !inAny(r.cx + nx * 2.2, r.cz + nz * 2.2, host) && !inAny(r.cx + nx * 0.8, r.cz + nz * 0.8, host), score = r.d + (open ? 0 : 60) + (L < 3 ? 4 : 0);
            if (!pick || score < pick.score) pick = { score, i, ax, az, bx, bz, L, ux, uz, nx, nz, t: r.t * L, open };
        }
        if (!pick) { rows.push({ name: biz.name, placed: false, why: 'no wall' }); continue; }
        const lv = clamp(Math.round(biz.level), -1, 4), key = host.id + ':' + pick.i + ':' + lv;
        if (!walls.has(key)) walls.set(key, { ...pick, lv, host, items: [] });
        walls.get(key).items.push({ biz, t: pick.t });
    }
    const items = [], aw = new GeoBatch();
    for (const W of walls.values()) {
        W.items.sort((a, b) => a.t - b.t);
        const gap = 0.25, room = W.L - 0.4, want = W.items.map((it) => clamp(0.85 + it.biz.name.length * 0.165, 1.5, 4.2));
        const nRows = Math.max(1, Math.ceil((want.reduce((s, w) => s + Math.min(w, room), 0) + gap * (W.items.length - 1)) / Math.max(room, 1.4) - 0.35)); // a second row only when halving the widths would not fit them
        for (let row = 0; row < nRows; row++) {
            const its = W.items.filter((_, i) => i % nRows === row), ws = its.map((it) => Math.min(room, clamp(0.85 + it.biz.name.length * 0.165, 1.5, 4.2)));
            const total = ws.reduce((s, w) => s + w, 0) + gap * (its.length - 1), k = total > room ? Math.max(0.5, (room - gap * (its.length - 1)) / (total - gap * (its.length - 1))) : 1;
            for (let i = 0; i < ws.length; i++) ws[i] *= k;
            // each at its own place; pushed right past its left neighbour, then the whole run pulled back inside the wall
            const c = []; let end = 0.2; its.forEach((it, i) => { c[i] = Math.max(it.t, end + ws[i] / 2); end = c[i] + ws[i] / 2 + gap; });
            let lim = W.L - 0.2; for (let i = its.length - 1; i >= 0; i--) { c[i] = Math.min(c[i], lim - ws[i] / 2); lim = c[i] - ws[i] / 2 - gap; }
            its.forEach((it, i) => {
                const x = W.ax + W.ux * c[i] + W.nx * 0.16, z = W.az + W.uz * c[i] + W.nz * 0.16, gy = yAt(x + W.nx * 1.4, z + W.nz * 1.4);
                const y = gy + (W.lv > 0 ? 3.9 * W.lv + 2.3 : 3.2) + row * 0.62, [bg, fg] = palette(it.biz);
                const st = signStyle(it.biz, [bg, fg]);
                items.push({ text: st.text, w: ws[i], h: W.lv > 0 ? 0.42 : st.h, x, y, z, yaw: Math.atan2(W.nx, W.nz), bg: st.bg, fg: st.fg, font: st.font });
                const kind = W.lv === 0 && row === 0 ? o.awning?.(W) : null;
                if (kind) { const n = Math.max(1, Math.round((ws[i] + 0.5) / 0.55)), w = (ws[i] + 0.5) / n; // a canvas awning under the sign, in stripes
                    for (let q = 0; q < n; q++) { const u = c[i] - (ws[i] + 0.5) / 2 + q * w, ax = W.ax + W.ux * u, az = W.az + W.uz * u, bx = ax + W.ux * w, bz = az + W.uz * w, col = kind === 'stripe' ? (q % 2 ? '#f3efe2' : '#2f6b48') : kind;
                        aw.quad([bx + W.nx * 0.1, y - 0.3, bz + W.nz * 0.1], [ax + W.nx * 0.1, y - 0.3, az + W.nz * 0.1], [ax + W.nx * 1.25, y - 0.85, az + W.nz * 1.25], [bx + W.nx * 1.25, y - 0.85, bz + W.nz * 1.25], col, 'fabric');
                        aw.quad([bx + W.nx * 1.25, y - 0.85, bz + W.nz * 1.25], [ax + W.nx * 1.25, y - 0.85, az + W.nz * 1.25], [ax + W.nx * 1.25, y - 1.05, az + W.nz * 1.25], [bx + W.nx * 1.25, y - 1.05, bz + W.nz * 1.25], col, 'fabric'); } }
                rows.push({ name: it.biz.name, placed: true, host: W.host.id, name2: W.host.name || '', level: W.lv, x: +x.toFixed(1), z: +z.toFixed(1), y: +y.toFixed(1), moved: +Math.hypot(x - it.biz.x, z - it.biz.z).toFixed(1), open: W.open });
            });
        }
    }
    const grp = new THREE.Group(); grp.name = 'storefronts'; grp.add(signAtlas(items, { name: 'storefront-signs', night: 1.1 })); { const m = aw.build('awnings'); m.traverse((o) => { if (o.material) o.material.side = THREE.DoubleSide; }); grp.add(m); } ctx.add(grp);
    const out = { total: rows.length, signs: items.length, hero: rows.filter((r) => r.hero).length, unplaced: rows.filter((r) => r.placed === false), rows };
    ctx.extras.shops = out; ctx.extras.storefronts = { signs: items.length, stallNames: 0 };
    return out;
}
