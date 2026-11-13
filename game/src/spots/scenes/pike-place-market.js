// ============================================================================
//  Pike Place Market — the market halls along the west side of Pike Place, as Street View shows them (Google
//  panoramas at 1504 and 1701 Pike Pl, viewed for reference only) on the OpenStreetMap footprints:
//   • north of the Leland Hotel the Main Arcade is ONE low storey on the street: a green-painted dado, a band of
//     small-paned windows, a cream fascia and an eave hung with flower baskets; cars park nose-in against it;
//   • from Pine St the North Arcade continues as a long low shed under a green metal roof, with the second
//     PUBLIC MARKET neon sign on a steel frame on its roof facing up Pine St;
//   • the halls step down the bluff behind (their west walls are several storeys above Western Ave).
//  The sign corner and the Leland Hotel (open market floor, fish stall, Rachel) stay in pike-place.js.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch, polyArea, inPoly } from '../kit.js';
import { triangulate } from '../../building-overlap.js';
import { neonSign, latticeFrame, stall } from '../props.js';
import { wallGeometry, facadeMaterial, facadeStyle } from '../osm.js';

// OSM footprint → height of the eave above the street (Street View estimates) and roof colour
export const HALLS = {
    w1275882970: { h: 4.6, roof: '#6d6a64' },   // the day-stall strip in front of the Leland Hotel and the Main Arcade
    w1271653801: { h: 5.6, roof: '#77736c' },   // Main Arcade
    // North Arcade: an open day-stall front under a low metal shed roof that rises away from the street (panoramas on Pike Pl at
    // Stewart St and north of it, ids grsVDUMkuBMlk2jyCNtErA, gUpSU7FwJVKGzsOM5hEfWg, qe8_CeOlBF2k55UTq3zkAg: tables under a dark
    // green fascia, a pale grey-green roof plane above it up to a level ridge). Eave, rise and run are estimates from those views.
    w231357659: { h: 5.1, roof: '#6f9182', shed: { eave: 3.3, run: 7, roof: '#6f9182' } },
};
const OPEN_UNTIL = 26; // m along Pike Place from Pike St: the open market front under the FARMERS MARKET fascia (pike-place.js)

export function prepareHalls(ctx) { for (const id of Object.keys(HALLS)) ctx.skipBuildings.add(id); }

/** @param {{ line:number[][], at:(x,z)=>{s,d,y} }} street Pike Place centreline + level */
export function buildHalls(ctx, street) {
    const g = ctx.ground, b = new GeoBatch(), grp = new THREE.Group(); grp.name = 'market-halls';
    const cream = '#e9dfc6', green = '#3d6a4d', dark = '#1b1815';
    let bays = 0;
    const others = ctx.data.buildings.filter((o) => o.k !== 'roof' && !o.part && o.poly?.length > 2);
    for (const m of ctx.data.buildings) {
        const H = HALLS[m.id]; if (!H) continue;
        const poly = polyArea(m.poly) > 0 ? m.poly : [...m.poly].reverse(), yS = poly.map(([x, z]) => street.at(x, z).y);
        const bottom = Math.min(...poly.map(([x, z]) => g.heightAt(x, z))) - 2;
        for (let i = 0; i < poly.length; i++) {
            const A = poly[i], B = poly[(i + 1) % poly.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 0.3) continue;
            const ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L; let nx = uz, nz = -ux; if (inPoly((A[0] + B[0]) / 2 + nx * 0.4, (A[1] + B[1]) / 2 + nz * 0.4, poly)) { nx = -nx; nz = -nz; }
            const ya = yS[i], yb = yS[(i + 1) % poly.length], mid = street.at((A[0] + B[0]) / 2, (A[1] + B[1]) / 2);
            const onStreet = mid.d < 9.6 && L > 2 && (nx * (mid.cx - (A[0] + B[0]) / 2) + nz * (mid.cz - (A[1] + B[1]) / 2)) > 0; // faces Pike Place
            if (!onStreet) {
                if (others.some((o) => o !== m && inPoly((A[0] + B[0]) / 2 + nx * 0.6, (A[1] + B[1]) / 2 + nz * 0.6, o.poly))) continue; // a party wall: the neighbour stands against it
                const top = Math.min(ya, yb) + H.h;
                if (top - bottom > 9 && L > 6) { const w = wallGeometry([A, B], bottom, top, facadeStyle('apartment'), top - 3.4 * Math.ceil((top - bottom) / 3.4), '#ddd3ba'); b.add(w, 'f-apartment', null, w.userData.col); }
                else b.quad([B[0], bottom, B[1]], [A[0], bottom, A[1]], [A[0], ya + H.h, A[1]], [B[0], yb + H.h, B[1]], '#d8ceb5', 'concrete');
                continue;
            }
            // the street front, bay by bay at the street's own level
            const n = Math.max(1, Math.round(L / 2.8)), w = L / n, yaw = Math.atan2(nx, nz);
            for (let k = 0; k < n; k++) {
                const t = (k + 0.5) / n, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t, at = street.at(x, z), y = at.y, door = bays % 5 === 2, open = at.s < OPEN_UNTIL; bays++;
                const P = (out, up) => [x + nx * out, y + up, z + nz * out];
                if (H.shed) {
                    const E = H.shed.eave; let run = 0; while (run < H.shed.run && inPoly(x - nx * (run + 0.5), z - nz * (run + 0.5), poly)) run += 0.5; run = Math.max(1.5, run);
                    b.box(...P(-Math.min(1.5, run - 0.1), 0), w, E, 0.1, dark, 'paint', yaw);                                  // the hall behind the day stalls
                    b.box(x - ux * w / 2, y, z - uz * w / 2, 0.14, E, 0.14, '#2f5a44', 'paint', yaw);                         // a post between two stalls
                    b.box(...P(-0.6, 0), w - 0.5, 0.78, 0.8, ['#e9e4d6', '#7a2e1d', '#2c4f39', '#30506e'][bays % 4], 'fabric', yaw); // the stall's covered table
                    b.box(...P(0.0, E - 0.45), w + 0.01, 0.45, 0.2, '#2f5a44', 'paint', yaw);                                  // fascia under the eave
                    const h2 = w / 2 + 0.005, e1 = [x - ux * h2 + nx * 0.5, y + E, z - uz * h2 + nz * 0.5], e2 = [x + ux * h2 + nx * 0.5, y + E, z + uz * h2 + nz * 0.5], r1 = [x - ux * h2 - nx * run, y + H.h + 0.03, z - uz * h2 - nz * run], r2 = [x + ux * h2 - nx * run, y + H.h + 0.03, z + uz * h2 - nz * run];
                    b.quad(e1, e2, r2, r1, H.shed.roof, 'roofs'); b.quad(e2, e1, r1, r2, H.shed.roof, 'roofs');           // the shed roof, eave to ridge
                    continue;
                }
                if (open) b.box(...P(-0.12, 0), w, 3.75, 0.1, dark, 'paint', yaw);                                         // the open stalls: a dark hall behind the counters
                else if (door) { b.box(...P(-0.3, 0), w - 0.5, 2.75, 0.1, dark, 'paint', yaw); for (const s of [-1, 1]) b.box(x + ux * s * (w / 2 - 0.14) + nx * 0.02, y, z + uz * s * (w / 2 - 0.14) + nz * 0.02, 0.28, 2.75, 0.3, green, 'paint', yaw); }
                else {
                    b.box(...P(0.02, 0), w, 1.05, 0.26, green, 'paint', yaw); b.box(...P(0.0, 1.05), w, 0.09, 0.34, '#2c4f39', 'paint', yaw);        // dado + sill
                    b.box(...P(-0.03, 1.14), w, 1.61, 0.08, '#aebfb9', 'glass', yaw);
                    for (let q = 0; q <= 4; q++) b.box(x + ux * (q / 4 - 0.5) * (w - 0.08) + nx * 0.04, y + 1.14, z + uz * (q / 4 - 0.5) * (w - 0.08) + nz * 0.04, 0.07, 1.61, 0.07, cream, 'paint', yaw);
                    b.box(...P(0.04, 1.9), w, 0.06, 0.07, cream, 'paint', yaw);
                }
                b.box(...P(0.0, 2.75), w + 0.01, 1.0, 0.3, cream, 'paint', yaw);                                           // fascia (the stall boards hang here)
                b.box(...P(0.34, 3.75), w + 0.01, 0.13, 1.1, '#2f5a44', 'paint', yaw);                                     // eave
                if (H.h > 3.95) b.box(...P(-0.05, 3.88), w + 0.01, H.h - 3.88, 0.2, cream, 'paint', yaw);
                if (!open && k % 2 === 0) { const [fx, fy, fz] = P(0.72, 3.18); b.rod([fx, fy + 0.5, fz], [fx, fy + 0.2, fz], 0.008, '#222', 'metal', 3); b.sphere(fx, fy, fz, 0.34, 0.26, 0.34, '#3f7a3a', 'plant', 8, 6); b.sphere(fx, fy + 0.08, fz, 0.3, 0.2, 0.3, ['#d81b60', '#f4511e', '#fdd835', '#e53935'][bays % 4], 'plant', 8, 6); } // flower basket
            }
        }
        // roof following the street's fall
        for (const tri of triangulate(poly) || []) { const v = tri.map(([x, z]) => [x, street.at(x, z).y + H.h, z]); const ny = (v[1][2] - v[0][2]) * (v[2][0] - v[0][0]) - (v[1][0] - v[0][0]) * (v[2][2] - v[0][2]); const [p, q, r] = ny > 0 ? v : [v[0], v[2], v[1]]; b.quad(p, q, r, r, H.roof, 'roofs'); }
        ctx.poly(poly, { y0: bottom, y1: Math.max(...yS) + H.h });
    }
    // the second PUBLIC MARKET sign: red neon letters on a steel frame on the North Arcade roof, facing up Pine St
    {
        const at = street.at(-147.9, -53.3), tx = -0.751, tz = -0.66, nx = 0.66, nz = -0.751, cx = at.cx - nx * 12.5 + tx * 1.5, cz = at.cz - nz * 12.5 + tz * 1.5, y = at.y + HALLS.w231357659.h, yaw = Math.atan2(nx, nz);
        latticeFrame(b, cx - nx * 0.3, y, cz - nz * 0.3, 12.5, 9.2, yaw, { cols: 4, r: 0.07 });
        for (const [text, up, w] of [['PUBLIC', 6.3, 8.4], ['MARKET', 3.5, 10.4]]) { const s = neonSign([{ text }], w, 2.5, { color: '#d7262b', glow: '#ff2d24', day: 0.3, night: 3.5, font: (q) => `900 ${q}px "Arial Black", "Helvetica Neue", Arial, sans-serif`, stroke: 3 }); s.position.set(cx + nx * 0.15, y + up + 1.25, cz + nz * 0.15); s.rotation.y = yaw; grp.add(s); }
    }
    // what stands in the street by the halls (Street View): farmers' pop-up tents with their tables along the North Arcade
    // (no cars: Pike Place is car-free here) and the yellow bollards at the Main Arcade's doors
    {
        const pts = street.line, seg = (s) => { let acc = 0; for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (s <= acc + L || i === pts.length - 1) { const t = (s - acc) / L, tx = (pts[i][0] - pts[i - 1][0]) / L, tz = (pts[i][1] - pts[i - 1][1]) / L; return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, z: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, tx, tz }; } acc += L; } };
        const west = (s, off) => { const p = seg(s); return { x: p.x + p.tz * off, z: p.z - p.tx * off, yaw: Math.atan2(-p.tz, p.tx), tx: p.tx, tz: p.tz }; }; // off m toward the halls
        let n = 0;
        for (let s = 152; s < 226; s += 9.5, n++) {
            const c = west(s, 4.9), y = street.at(c.x, c.z).y, col = n % 3 === 1 ? '#c8302a' : '#f4f2ec', half = 1.5, top = y + 2.25, apex = y + 3.05;
            const corner = (i, j) => [c.x + c.tx * i * half + c.tz * j * half, c.z + c.tz * i * half - c.tx * j * half];
            const C = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
            for (const [x, z] of C) { b.cyl(x, y, z, 0.022, top - y, '#c9ccce', 'metal', 6); ctx.circle(x, z, 0.06, 2.2, { y }); }
            for (let k = 0; k < 4; k++) { const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 4]; b.quad([ax, top, az], [bx, top, bz], [c.x, apex, c.z], [c.x, apex, c.z], col, 'fabric'); b.quad([bx, top, bz], [ax, top, az], [c.x, apex, c.z], [c.x, apex, c.z], col, 'fabric');
                b.quad([ax, top - 0.26, az], [bx, top - 0.26, bz], [bx, top, bz], [ax, top, az], col, 'fabric'); b.quad([bx, top - 0.26, bz], [ax, top - 0.26, az], [ax, top, az], [bx, top, bz], col, 'fabric'); }
            stall(b, c.x, y, c.z, c.yaw + Math.PI, { w: 2.5, kind: ['produce', 'flowers', 'produce'][n % 3], seed: 70 + n }); ctx.box(c.x, c.z, 1.3, 0.6, c.yaw, { prop: true, h: 0.85 });
        }
        for (const s of [33, 36.2, 47.5, 50.7, 61.5, 64.7]) { const q = west(s, 6.1), y = street.at(q.x, q.z).y; b.cyl(q.x, y, q.z, 0.07, 0.95, '#e8c21c', 'paint', 10); ctx.circle(q.x, q.z, 0.1, 0.95, { y }); }
        ctx.extras.marketHalls = { tents: n };
    }
    grp.add(b.build('market-halls', { matOverrides: { 'f-apartment': facadeMaterial('apartment') } }));
    ctx.add(grp);
    ctx.extras.marketHalls = { ...ctx.extras.marketHalls, bays };
}
