// ============================================================================
//  Landmarks — Bellevue landmarks: Bellevue Towers, Bellevue Square, Lincoln Square, One Lincoln, Plaza Center, Sonic, 600 Bellevue.
//  Part of the landmark models of landmarks.js (split out of it, spec 22); conventions in landmarks.js' header.
// ============================================================================
import { buildBellevueSquare, BELLEVUE_MACYS_SOURCE } from '../landmark-bellevue-square.js';
import { US_FOOTPRINTS as U, US_SOURCE_TAGS as UT } from '../landmark-us-source.js';
import { offset, M } from './kit.js';
import { facadeQuad, edgeN, curtainTower } from './parts.js';

// Bellevue Towers (2008) — twin residential towers on a 5-level podium: North 137 m / 43 levels, South 131 m / 42 levels
// (OSM w370237986 / w370239409); blue-green glazing #7a96a8 with white slab edges,
// glass parapet crowns, rooftop garden on the podium between them.
// Src: https://www.skyscrapercenter.com/complex/2787 ; game/research/seattle-bellevue.json landmarks[bellevue-towers]
export function bBellevueTowers(b) {
    const [n,s,pod] = ['w370237986','w370239409','w118119171'].map(id=>U[id]);
    // (round 2, panoramas at 47.613977, -122.198816 heading 54 and NE 4th / 106th heading 47, viewed only): the podium is
    // grey-beige stone with a tall glazed retail floor under a canopy line and windows above; the model wrapped it in five
    // bold blue-and-cream stripes (a car-park look).
    // (r2-landmarks-b-2, round 2b at 47.613977, -122.198816 h 54) the podium stone is a darker grey than the first estimate
    b.prism(pod, 0, 18, '#9c978e', { topCol: '#7f9e6b' });
    b.windows(pod, 0, 5.6, 5.6, '#56707f', { bay: 6.5, wf: 0.84, hf: 0.8, start: 0.2, mat: 'g', minL: 5, off: 0.07 });
    b.cornice(pod, 5.6, 0.35, 0.9, '#8f979b');
    b.windows(pod, 6.2, 17.6, 3.8, '#5d7887', { bay: 3.25, wf: 0.6, hf: 0.6, start: 0.7, mat: 'g', minL: 5, off: 0.07 });
    for (const [p, h] of [[n, 137], [s, 131]]) {          // OSM: North 137 m/43 levels; South 131 m/42 levels, including crowns
        b.prism(p, 18, h - 7, '#7a96a8', { mat: 'g', topCol: '#c7d0d6' });
        b.bands(p, 18, h - 7, 3.1, '#d9e0e4', { frac: 0.12, off: 0.1 });
        b.prism(offset(p, -2.5), h - 7, h - 2, '#cfd6da');
        b.ring(p, h - 7, h, '#9db7c6', { mat: 'g' });                                           // glass parapet crown
        b.pilasters(p, 18, h - 7, 8, 0.35, 0.35, '#dfe6ea', {});
    }
    b.colPolygon(pod, { y1: 18 });
}

// Bellevue Square (1946, rebuilt as an enclosed mall 1981) — 3-level regional mall (OSM way 29234887),
// skylit malls, main glazed entrance + lettering on Bellevue Way NE (east, model -z).
// Src: https://en.wikipedia.org/wiki/Bellevue_Square ; OSM way 29234887
export function bBellevueSq(b, ctx = {}) {
    // Exact OSM outline and the contained, undimensioned Macy's part share the
    // sourced low mall envelope. The old random 57.6m glass estimate is not a tower.
    buildBellevueSquare(b, ctx.sourceBuildings?.w29234887?.[0]?.ring || U.w29234887,
        ctx.sourceBuildings?.w497739259?.[0]?.ring || BELLEVUE_MACYS_SOURCE);
}

// ---------------------------------------------------------------------------
// Lincoln Square (The Bellevue Collection, Kemper Development) — north block, R12.6b hero + final CV stop.
// UiPath Bellevue: Lincoln Square North office tower, 700 Bellevue Way NE, Suite 2000 (two floors, 44,735 sq ft,
// since Sept 2025 — uipath.com/about-us/offices, GeekWire 2025). Tower 126 m / 28 floors (2005); staff entrance =
// OSM entrance node 7945526075 (47.61723, -122.20148) on the Bellevue Way frontage just south of NE 8th, facing west.
// One Lincoln Tower (Westin Bellevue + condos) 137 m / 42 floors with white "WESTIN" on the west face of the crown.
// 3-level retail podium (10455 NE 8th St: Cinemark Reserve, Din Tai Fung, Earls, Paddy Coyne's…), brick-toned masonry
// #b57f52 above storefront glazing. Skybridges (OSM): over Bellevue Way to Bellevue Square (w43872832, 2007, ~32 m),
// diagonally over NE 8th to Bellevue Place / Hyatt (w43872826 + bridge building w1364249504, ~56 m), over NE 6th to
// Lincoln Square South (w516915099, ~22 m). Colours: LSN glass #7f97ad, spandrel #c8ced3, mullion #9aa1a6, crown
// #5f6163; One Lincoln glass #6f786f, frame #4f5550, balcony glass #8b9590, crown #76807a (photo-sampled, research).
// No exterior UiPath sign exists in open sources -> generic tenant signage only ("700", "LINCOLN SQUARE NORTH").
// Src: game/research/seattle-bellevue.json landmarks[lincoln-square] ; en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington ;
//      OSM w604028609 / w604028611 / w328017119 / w161929514 / w1474737770 / w1364249504 ; refs/bellevue/Lincoln_Square_Office_Tower_and_One_Lincoln_Tower.jpg
export function bLincolnN(b) {
    // P2.lincoln coordinates are relative to 47.6164962, -122.2008984; this entry's anchor (A.lincoln) sits 10 m W / 40 m N of it
    // so that the suppression radius covers the tower, the podium and the uipath-bel door point but not the Paccar building.
    b.shift(10, 40);
    const [lsn,pod,br8]=['w604028609','w161929514','w1364249504'].map(id=>U[id]);
    // Podium walls are cream / tan stone panels over a grey storefront base (street-level review 2026-11-12, both street faces
    // and the curved corner); red brick is only an accent bay at the NE 8th skybridge landing, so it is not the wall colour.
    const BRICK = '#d9cba6', STONE = '#e6dcc3', SHOP = '#33414b', DK = '#2b3034', GLOW = '#f2dcae';
    // --- retail podium (3 levels, ~16 m): storefronts at grade, cream stone + lighter stone bands above
    b.wall = BRICK;
    b.prism(pod, 0, 16, BRICK, { topCol: '#8e8a84' });
    b.prism(offset(pod, 0.15), 0, 5.2, SHOP, { mat: 'g', top: false });                    // storefront glazing
    b.cornice(pod, 5.2, 0.7, 0.45, STONE); b.cornice(pod, 15.2, 0.9, 0.5, STONE);
    // (round 2, 2026-11-12) Street View on Bellevue Way at 47.61709 and 47.61647: the upper podium is wide blue-glass bays
    // between stone piers (the model had dark slits), the bay south of the Bellevue Square skybridge (z ≈ -25 … 0) is
    // red-brown brick with the same glazing, and brick piers stand between the shopfronts at the sidewalk. Only the Bellevue
    // Way faces were looked at, so the NE 8th and court faces keep the earlier windows. Bay width (≈ 7.5 m), sill / head
    // heights and the brick stretch's exact ends are estimates.
    const BAY = '#6d93b8', RED = '#7d4a3a';
    b.bands(pod, 6.4, 15, 4.3, '#3c4850', { frac: 0.5, pitch: 6, wall: BRICK });           // L2/L3 windows split by piers (faces not reviewed)
    for (let i = 0; i < pod.length; i++) {
        const a = pod[i], c = pod[(i + 1) % pod.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = edgeN(pod, i); if (L < 3 || n[0] > -0.9) continue; // Bellevue Way (west) faces
        const k = Math.max(1, Math.round(L / 7.5)), P3 = (t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t], brickFrom = L > 40 ? 1 - 25 / L : 2;
        facadeQuad(b, a, c, 5.9, 15.2, BRICK, 'm', n, 0.26);
        if (brickFrom < 1) facadeQuad(b, P3(brickFrom), c, 5.9, 15.2, RED, 'm', n, 0.29);    // the brick bay south of the skybridge (edge 20, its north 25 m)
        for (let j = 0; j < k; j++) facadeQuad(b, P3((j + 0.13) / k), P3((j + 0.87) / k), 6.7, 13.9, BAY, 'g', n, 0.33); // wide glazed bays between the piers
        facadeQuad(b, a, c, 10.15, 10.45, '#56636d', 'm', n, 0.37);                         // the floor line across the bays
        for (let j = 0; j <= k; j++) { const q = P3(j / k); b.box(q[0] + n[0] * 0.25, 0, q[1] + n[1] * 0.25, 0.5, 5.2, 1.2, RED); }                      // brick piers at the sidewalk
    }
    for (let i = 0; i < pod.length; i++) {                                                  // sidewalk canopies on the street faces
        const a = pod[i], c = pod[(i + 1) % pod.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 12) continue;
        const n = edgeN(pod, i); if (n[1] > 0.7) continue;                                  // not on the inner (south) court side
        const mx = (a[0] + c[0]) / 2 + n[0] * 1.4, mz = (a[1] + c[1]) / 2 + n[1] * 1.4;
        b.box(mx, 4.3, mz, L * 0.8, 0.35, 2.8, '#2f5d8e', { ry: -Math.atan2(c[1] - a[1], c[0] - a[0]) }); // (r2-landmarks-5) blue awnings (street-level review 2026-11-12)
    }
    // (r2-landmarks-5) the street-level review of 2026-11-12 (seattle-bellevue.md §6.1) saw a red-brick accent bay where the diagonal NE 8th St
    // skybridge lands on the podium; drawn on the north (NE 8th) face round the bridge's nearest source vertex, 12 m wide (estimate)
    {
        let best = null;
        for (let i = 0; i < pod.length; i++) {
            const a = pod[i], c = pod[(i + 1) % pod.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = edgeN(pod, i); if (L < 8 || n[1] > -0.8) continue;
            for (const q of br8) { const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * (c[0] - a[0]) + (q[1] - a[1]) * (c[1] - a[1])) / (L * L))), d = Math.hypot(a[0] + (c[0] - a[0]) * t - q[0], a[1] + (c[1] - a[1]) * t - q[1]); if (!best || d < best.d) best = { d, a, c, t, L, n }; }
        }
        if (best && best.d < 6) { const { a, c, t, L, n } = best, h = 6 / L, P3 = (k) => [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k]; facadeQuad(b, P3(Math.max(0, t - h)), P3(Math.min(1, t + h)), 5.9, 15.2, RED, 'm', n, 0.2); }
    }
    b.text('LINCOLN SQUARE', -31, 10.2, -87.85, Math.PI, 1.4, '#3a342c');                       // NE 8th St face (north); dark letters on the cream stone
    // --- Lincoln Square North tower (UiPath): 126 m = lobby + 27 office floors (3.95 m) + recessed top + louvred crown
    curtainTower(b, lsn, 0, 112, { glass: '#7f97ad', spandrel: '#c8ced3', mullion: '#9aa1a6', pitch: 3.1, fh: 3.95, start: 9, frac: 0.6 });
    const lt = offset(lsn, -1.2);
    curtainTower(b, lt, 112, 120, { glass: '#5f7385', spandrel: '#8f979d', fh: 3.95, start: 0.6, frac: 0.66 });
    b.ring(offset(lsn, -0.4), 120, 126, '#5f6163'); b.cap(offset(lsn, -0.4), 126, '#6b6e70');
    for (let y = 120.6; y < 125.6; y += 0.9) b.ring(offset(lsn, -0.25), y, y + 0.25, '#7d8083');   // louvres
    // --- the UiPath / tower lobby on Bellevue Way (west, at the entrance node): double-height glazing with a warm glow,
    //     following the podium edge (-41.5,-85) -> (-45,-77.5) -> (-46,-68.5)
    const LP = [[-41.5, -85], [-45, -77.5], [-46, -68.5]];
    for (let i = 0; i + 1 < LP.length; i++) {
        const a = LP[i], c = LP[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = [-(c[1] - a[1]) / L, (c[0] - a[0]) / L];
        if (n[0] > 0) { n[0] = -n[0]; n[1] = -n[1]; }                                       // outward = west
        facadeQuad(b, a, c, 0.2, 8.4, GLOW, 'e', n, 0.52);
        const k = Math.max(2, Math.round(L / 2.1));
        for (let j = 0; j <= k; j++) { const t = j / k; b.box(a[0] + (c[0] - a[0]) * t + n[0] * 0.66, 0, a[1] + (c[1] - a[1]) * t + n[1] * 0.66, 0.2, 8.6, 0.25, DK); }   // mullions
        for (const [y, w, h, col] of [[4.3, 0.22, 0.22, DK], [8.7, 0.45, 0.5, '#9aa1a6']]) b.strut([a[0] + n[0] * 0.66, y, a[1] + n[1] * 0.66], [c[0] + n[0] * 0.66, y, c[1] + n[1] * 0.66], w, h, col);
    }
    const ex = -43.27, ez = -81.2, en = [-0.906, -0.423], ery = Math.atan2(en[0], en[1]);  // OSM entrance node 7945526075 (on the first segment)
    const EW = (lx, lz) => [ex + lx * en[1] + lz * en[0], ez - lx * en[0] + lz * en[1]];  // entrance frame: +x along the facade, +z outward
    b.push(M(ex, 0, ez, ery));
    b.box(0, 8.9, 2.6, 9, 0.45, 5.4, '#e4e6e7');                                             // entrance canopy
    b.box(0, 8.6, 5.25, 9.4, 0.75, 0.3, '#4d5357');                                          // canopy fascia
    b.cyl(0, 0, 0.75, 1.5, 1.5, 3, '#9aa7ae', 10, { mat: 'g' }); b.cyl(0, 3, 0.75, 1.6, 1.6, 0.3, '#3a3f42', 10);   // revolving door
    for (const s of [-1, 1]) b.box(s * 3.2, 0, 0.55, 2.2, 2.9, 0.12, '#adbcc4', { mat: 'g' });          // side doors
    b.box(-5.8, 0, 3.6, 1.2, 1.5, 0.5, '#c9c2b3');                                          // address plinth
    b.pop();
    { const q = EW(0, 5.42); b.text('LINCOLN SQUARE NORTH', q[0], 8.68, q[1], ery, 0.5, '#f4f4f2', { d: 0.02 }); }
    { const q = EW(-5.8, 3.86); b.text('700', q[0], 0.55, q[1], ery, 0.6, '#2e3338', { d: 0.02 }); }
    // --- skybridges (enclosed glass boxes on light-grey steel)
    skybridge(b, [-45.4, -28.1], [-76.1, -20.8], 6.2);                                                // over Bellevue Way to Bellevue Square
    // The landing remains the real Bellevue Square source footprint; do not invent
    // a detached retail block to meet this bridge.
    b.prism(br8, 6.6, 11, '#b4cfd9', { mat: 'g', bottom: true, topCol: '#eef0f0' });         // diagonal NE 8th St bridge (w1364249504)
    b.cornice(br8, 6.6, 0.5, 0.25, '#eef0f0'); b.cornice(br8, 10.8, 0.5, 0.3, '#eef0f0');
    // Its sides are an open white steel truss (street-level review 2026-11-12), drawn on the two long source edges.
    for (let i = 0; i < br8.length; i++) { const p = br8[i], q = br8[(i + 1) % br8.length]; if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 12) trussSide(b, p, q, 6.85, 10.8); }   // long edges only (the two ends are the landings)
    // (bellevue-7) a glazed pitched roof over the bridge (ridge 1.2 m above the eaves, along the centre line of the source
    // outline; the ridge height is an estimate). The white curved pier on the north sidewalk is not drawn: its place is not
    // mapped (seattle-bellevue.md)
    if (br8.length === 6) {
        const Lf = [br8[0], br8[1], br8[2]], Rt = [br8[5], br8[4], br8[3]], C = Lf.map((p, i) => [(p[0] + Rt[i][0]) / 2, (p[1] + Rt[i][1]) / 2]), E = 11, R = 12.2, GLR = '#9fc2cf';
        for (const side of [Lf, Rt]) for (let i = 0; i < 2; i++) b.quad([side[i][0], E, side[i][1]], [side[i + 1][0], E, side[i + 1][1]], [C[i + 1][0], R, C[i + 1][1]], [C[i][0], R, C[i][1]], GLR, 'g');
        for (const i of [0, 2]) b.quad([Lf[i][0], E, Lf[i][1]], [C[i][0], R, C[i][1]], [C[i][0], R, C[i][1]], [Rt[i][0], E, Rt[i][1]], '#eef0f0', 'm');   // gable ends
    }
    b.colPolygon(pod, { y1: 16 });                                                                   // (skybridge spans have no collision)
}
/** glazed skybridge box on a light steel frame between two plan points at floor height y */
function skybridge(b, a, c, y, w = 5, h = 4.2) {
    b.strut([a[0], y + h / 2, a[1]], [c[0], y + h / 2, c[1]], w, h, '#b4cfd9', 'g');
    b.strut([a[0], y - 0.35, a[1]], [c[0], y - 0.35, c[1]], w + 0.5, 0.7, '#eef0f0');
    b.strut([a[0], y + h + 0.25, a[1]], [c[0], y + h + 0.25, c[1]], w + 0.6, 0.5, '#eef0f0');
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
    for (const s of [-1, 1]) { const ux = -(c[1] - a[1]) / L * s * (w / 2 + 0.08), uz = (c[0] - a[0]) / L * s * (w / 2 + 0.08); trussSide(b, [a[0] + ux, a[1] + uz], [c[0] + ux, c[1] + uz], y, y + h); }
}
/** one side of a skybridge: white steel posts every ~4 m with alternating diagonals between the bottom (y0) and top (y1) chords.
 *  The Lincoln Square skybridges are open steel trusses with glazing behind (street-level review 2026-11-12). */
function trussSide(b, a, c, y0, y1, col = '#eef0f0') {
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(2, Math.round(L / 4)), at = (k) => [a[0] + (c[0] - a[0]) * k / n, a[1] + (c[1] - a[1]) * k / n];
    for (let k = 0; k <= n; k++) {
        const p = at(k); b.strut([p[0], y0, p[1]], [p[0], y1, p[1]], 0.2, 0.2, col);
        if (k < n) { const q = at(k + 1), up = k % 2 === 0; b.strut([p[0], up ? y0 : y1, p[1]], [q[0], up ? y1 : y0, q[1]], 0.16, 0.16, col); }
    }
}

// One Lincoln Tower + Westin Bellevue (Lincoln Square, 2005) — 137 m / 42 floors: Westin hotel floors 4-~10, condos above;
// green-grey glass #6f786f, dark frame #4f5550, stacked glass balconies #8b9590 on the condo floors, crown #76807a with white
// "WESTIN" letters on its west face (photo refs/bellevue/Lincoln_Square_Office_Tower_and_One_Lincoln_Tower.jpg); 2-level Westin
// entrance podium (600 Bellevue Way NE), level 2-3 connector to the retail podium, skybridge over NE 6th to Lincoln Square South.
// Src: game/research/seattle-bellevue.json landmarks[lincoln-square].complex ; OSM w604028611 / w328017119 / w1474737770 / w516915099
export function bOneLincoln(b) {
    b.shift(-0.89, -59.21);                                                                 // P2.lincoln coordinates -> this anchor
    const [one,westin,conn]=['w604028611','w328017119','w1474737770'].map(id=>U[id]);
    // --- Westin podium (2 levels) + One Lincoln Tower (137 m: hotel floors 4-~10, condos above)
    b.prism(westin, 0, 10.5, '#c9bfae', { topCol: '#7f9c6c' });
    b.prism(offset(westin, 0.12), 0, 4.8, '#37444d', { mat: 'g', top: false });
    // (r2-landmarks-5, round 2 panoramas on Bellevue Way NE) the podium south of the retail block has punched square windows in tan stone,
    // not continuous window ribbons; window size and pitch are estimates
    b.cornice(westin, 4.8, 0.6, 0.4, '#e2dccf'); b.windows(westin, 5.6, 10.2, 4.4, '#3f4b52', { bay: 3.6, wf: 0.44, hf: 0.42, start: 0.9, mat: 'g', minL: 4, off: 0.07 });
    b.prism(conn, 7, 15.5, '#bfb6a6', { bottom: true, topCol: '#8e8a84' }); b.windows(conn, 7, 15.5, 4.2, '#3f4b52', { bay: 3.6, wf: 0.44, hf: 0.42, start: 1.0, mat: 'g', minL: 4, off: 0.07 });
    b.text('THE WESTIN', -44.7, 6.2, 70, -Math.PI / 2, 1.1, '#f6f3ec');
    // (round 2, panoramas on Bellevue Way NE at 47.616895, -122.2018 heading 105-140 and NE 4th at 47.615169, -122.201847
    // heading 39, viewed only): the tower reads as blue reflective glass with white slab-edge bands, like its neighbours;
    // the model was a matt grey-green grid with dark mullions (a brown block on the skyline).
    curtainTower(b, one, 10.5, 131, { glass: '#6f8ea6', spandrel: '#dde2e2', mullion: '#b4bdc2', pitch: 4.2, mw: 0.14, md: 0.16, fh: 3.05, frac: 0.7, start: 0.6 });
    for (let y = 40; y < 129; y += 3.05) {                                                   // stacked glass balconies (south + east faces of the condo floors)
        b.box(37, y, 81.9, 14, 0.18, 1.8, '#c9ccc8'); b.box(37, y + 0.18, 82.75, 14, 1.0, 0.06, '#8b9590', { mat: 'g' });
        b.box(46.1, y, 72, 1.8, 0.18, 16, '#c9ccc8'); b.box(47, y + 0.18, 72, 0.06, 1.0, 16, '#8b9590', { mat: 'g' });
    }
    b.ring(offset(one, 0.06), 131, 137, '#7d98ab', { mat: 'g' }); b.ring(offset(one, -0.3), 131, 137, '#7d98ab', { inward: true }); b.cap(offset(one, -0.3), 133, '#6b706c');
    b.text('WESTIN', -13.6, 132.2, 72, Math.atan2(-0.986, -0.164), 2.6, '#ffffff');                          // white letters, west face of the crown
    skybridge(b, [14.8, 85.9], [11.7, 108], 6.2, 5, 4.6);                                 // over NE 6th to Lincoln Square South
    b.colPolygon(westin, { y1: 10.5 }); b.colPolygon(one, { y0: 10.5, y1: 137 }); b.colPolygon(conn, { y0: 7, y1: 15.5 });
}

// Lincoln Square South (2017, Kemper) — 400 Lincoln Square office tower 137 m / 31 fl. (blue-grey glass #6e8a9e,
// fine silver mullions #b9c0c4, stepped crown) and Two Lincoln Tower (W Bellevue hotel + residences, 137 m / 42 fl.,
// glass #6b7c86 with balcony bands, W hotel sign at the base on NE 6th St) on the 3-level podium at 500 Bellevue Way NE.
// Src: game/research/seattle-bellevue.json (complex[]) ; OSM w1326151866 / w604028603 / w1326151868 ; skyscrapercenter.com/building/400-lincoln-square/22497
export function bLincolnS(b) {
    const [t400,two,pod]=['w1326151866','w604028603','w1326151868'].map(id=>U[id]);
    b.wall = '#b9ac98';
    b.prism(pod, 0, 15.5, '#b9ac98', { topCol: '#8a8781' });
    b.prism(offset(pod, 0.15), 0, 5, '#33414b', { mat: 'g', top: false });
    b.cornice(pod, 5, 0.6, 0.4, '#ddd5c6'); b.cornice(pod, 14.8, 0.8, 0.45, '#ddd5c6');
    // (round 2, panorama on Bellevue Way NE at 47.61479, -122.201752 heading 93, viewed only): tall glazed shopfront bays
    // between tan stone piers on both upper levels, not small punched windows
    b.windows(pod, 5.9, 14.6, 4.3, '#5f8098', { bay: 8.4, wf: 0.8, hf: 0.78, start: 0.35, mat: 'g', minL: 6, off: 0.08 });
    // 400 Lincoln Square: 31 office floors from level 4, stepped glass crown
    curtainTower(b, t400, 15.5, 128, { glass: '#6e8a9e', spandrel: '#7f96a6', mullion: '#b9c0c4', pitch: 1.6, mw: 0.12, md: 0.18, fh: 3.75, frac: 0.78, start: 0.4 });
    const c1 = offset(t400, -2.5); b.prism(c1, 128, 133, '#6e8a9e', { mat: 'g', topCol: '#9fa8ad' }); b.pilasters(c1, 128, 133, 1.6, 0.12, 0.18, '#b9c0c4', {});
    const c2 = offset(t400, -6); b.ring(c2, 133, 137, '#879fb0', { mat: 'g' }); b.cap(c2, 134, '#8e9498');
    // Two Lincoln Tower: glass with continuous balcony slab edges
    curtainTower(b, two, 15.5, 131, { glass: '#6c8ba3', spandrel: '#e2e4e2', fh: 3.0, frac: 0.72, start: 0.3 });   // (round 2: blue glass between white balcony bands, panorama 47.613915, -122.201845 heading 39)
    b.ring(offset(two, 0.05), 131, 137, '#7c8b94', { mat: 'g' }); b.cap(offset(two, -0.3), 133, '#8e9498');
    b.box(18, 6, -85.8, 9, 3, 0.4, '#141414'); b.text('W BELLEVUE', 18, 6.8, -86.05, Math.PI, 1.2, '#f2f2f2');   // W hotel at the base on NE 6th St
    b.colPolygon(pod, { y1: 16 });
}

// Plaza Center (10900 NE 8th St, 1982) — UiPath's Bellevue office from 2018 to Sept 2025 (Suite 400), a passing landmark
// with a story caption. 68 m / 16 floors, rectangle ≈ 35 x 60 m with notched corners (OSM w33725899), long axis N-S,
// set back behind a plaza on the north side of NE 8th. Facade (CC0 photo 2026-10-26): full-height ivory precast piers
// #ddd6bf alternating with continuous dark glass strips #2f3338 (~1 m pier / ~1.6 m glass), ivory parapet, recessed black
// glazed ground floor #1a1b1d with "10900" over the doors and a U.S. Bank branch, small dark "PLAZA CENTER" letters near
// the top of the NE 8th face, and a tall black pylon with huge vertical white numerals "10900" at the west driveway.
// Src: game/research/seattle-bellevue.json landmarks[plaza-center] ; OSM w33725899 ; refs/bellevue/Plaza_Center_Bellevue_WA.jpg
export function bPlazaCenter(b) {
    const p = U.w33725899, IV = '#ddd6bf', GL = '#2f3338', BK = '#1a1b1d';
    b.prism(p, 5.6, 66, GL, { mat: 'g', topCol: '#8f8a7e' });
    b.prism(offset(p, -1.2), 0, 5.6, BK, { mat: 'g', top: false });                          // recessed black ground floor
    b.ring(p, 5.2, 5.6, IV); b.cap(p, 5.2, '#3a3b3d', [offset(p, -1.2)], -1);                 // soffit
    b.pilasters(p, 5.6, 66, 2.6, 1.0, 0.32, IV, {});                                          // full-height ivory piers
    b.ring(offset(p, 0.33), 66, 68.2, '#d8d1bb'); b.lip(p, offset(p, 0.33), 68.2, '#cfc8b2', 1); // plain parapet band
    b.ring(p, 66, 68.2, '#d8d1bb');
    for (const [x, z] of [[-17.5, -30], [17.5, -30], [-17.5, 30], [17.5, 30]]) b.box(x * 0.94, 0, z * 0.95, 1.2, 5.6, 1.2, IV);   // corner piers at grade
    // NE 8th St (south) frontage: entrance under "10900", U.S. Bank branch, PLAZA CENTER near the top (east end)
    const zf = 30.4;
    b.box(-4, 0, zf - 1.1, 7, 3.2, 0.2, '#56636c', { mat: 'g' });
    b.text('10900', -4, 3.7, zf - 0.9, 0, 0.7, '#f4f4f4');
    b.box(6.5, 3.4, zf - 1.0, 4.6, 1.1, 0.12, '#ffffff'); b.text('U.S. BANK', 6.5, 3.55, zf - 0.92, 0, 0.7, '#c8102e');
    b.box(-4, 3.6, zf + 1.2, 8, 0.3, 3.2, '#2a2b2d');                                         // entrance canopy
    b.text('PLAZA CENTER', 11.5, 62.4, zf + 0.25, 0, 0.8, '#3a3a38');
    // "10900" pylon at the west driveway: tall black slab, vertical white numerals facing NE 8th and west
    const px = -25, pz = 26;
    b.box(px, 0, pz, 2.4, 12, 1.6, '#151617');
    [...'10900'].forEach((ch, i) => { const y = 10.1 - i * 2.05; b.text(ch, px, y, pz + 0.8, 0, 1.75, '#f2f2f2'); b.text(ch, px - 1.2, y, pz, -Math.PI / 2, 1.75, '#f2f2f2'); });
    for (const [x, z] of [[-10, 38], [3, 38], [16, 38]]) b.box(x, 0, z, 3, 0.7, 3, '#8c867a');   // plaza planters (the world plants the street trees)
    b.colPolygon(p, { y1: 68.2 }); b.col(px, pz, 1.2, 0.8);
}

// Amazon Sonic (555 108th Ave NE, ex-"555 Tower", 2023) — 183 m / 42 floors, joint tallest in Bellevue; OSM main part
// w1214424283 (42 levels), north slab w1556489725 (32 levels ≈ 125 m), base w1214423752 (3 levels). The research only
// notes "the tallest dark-glass block" seen from the Murrow bridge: dark blue-grey glass, fine mullions (estimated).
// Src: en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington (600 ft, 42 fl.) ; OSM w1214424283/w1556489725/w1214423752
export function bSonic(b) {
    const [main,slab,base]=['w1214424283','w1556489725','w1214423752'].map(id=>U[id]);
    b.prism(base, 0, 13, '#3d4852', { mat: 'g', topCol: '#7c8a6c' }); b.cornice(base, 12.4, 0.6, 0.3, '#c9ced2');
    curtainTower(b, main, 13, 177, { glass: '#3b4c5c', spandrel: '#44525e', mullion: '#9aa4ad', pitch: 3, mw: 0.14, fh: 4.1, frac: 0.82, start: 0.3 });
    b.ring(offset(main, 0.05), 177, 183, '#4c5d6d', { mat: 'g' }); b.cap(offset(main, -0.3), 178.5, '#6f777d');
    curtainTower(b, slab, 13, 124.8, { glass: '#3b4c5c', spandrel: '#44525e', mullion: '#9aa4ad', pitch: 3, mw: 0.14, fh: 3.9, frac: 0.82, start: 0.3 });
    b.colPolygon(base, { y1: 13 });
}

// Bellevue 600 (2025) — 183 m / 43 floors office tower, joint tallest in Bellevue (OSM w1453402305). No facade
// research: light blue-grey glass with white slab edges (estimated, low confidence).
// Src: en.wikipedia.org/wiki/List_of_tallest_buildings_in_Bellevue,_Washington ; OSM w1453402305
export function bBellevue600(b) {
    // Complete mapped podium and the 183 m / 43-level tower. Storey heights of
    // low podium parts are explicit 4.2 m estimates where OSM gives only levels.
    const p=U.w1453402305;
    for(const id of ['w1474780170','w1474780171','w1474780172','w1474780173']){const q=U[id],h=+UT[id]['building:levels']*4.2;b.prism(q,0,h,'#c4c8c7',{topCol:'#858e86'});b.bands(q,0,h,4.2,'#536b7b',{frac:.72,mat:'g'});b.colPolygon(q,{y1:h});}
    curtainTower(b,p,0,178,{glass:'#7b93a3',spandrel:'#b5c1c7',mullion:'#c9d0d4',pitch:3.5,fh:4.05,frac:0.82,start:6});
    b.ring(offset(p,0.05),178,183,'#8aa1af',{mat:'g'});b.cap(offset(p,-0.3),179.5,'#8e9498');b.colPolygon(p,{y1:183});
}
