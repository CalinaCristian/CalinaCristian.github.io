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
import { neonSign, latticeFrame } from '../props.js';
import { wallGeometry, facadeMaterial, facadeStyle } from '../osm.js';

// OSM footprint → height of the eave above the street (Street View estimates) and roof colour
export const HALLS = {
    w1275882970: { h: 4.6, roof: '#6d6a64' },   // the day-stall strip in front of the Leland Hotel and the Main Arcade
    w1271653801: { h: 5.6, roof: '#77736c' },   // Main Arcade
    w231357659: { h: 4.7, roof: '#4f7d68' },    // North Arcade (green standing-seam roof)
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
    grp.add(b.build('market-halls', { matOverrides: { 'f-apartment': facadeMaterial('apartment') } }));
    ctx.add(grp);
    ctx.extras.marketHalls = { bays };
}
