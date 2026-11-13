// ============================================================================
//  Pike Place — the SkyBridge over Western Ave (OSM way 296789534, building=roof, layer=1, name=SkyBridge), from the
//  market's west side to the Pike Place Market Parking garage. The native renderer drew the mapped roof as a dark slab on
//  posts. Street View (panorama iFZRr4o9WP2yFdlbuLUkeQ, Western Ave at 47.60878,-122.34155, looking 315–318°): an
//  enclosed walkway between two green steel Warren trusses (top and bottom chords, diagonals), pale green panels inside,
//  a flat roof over the top chords, and a white concrete pier at the market-side kerb.
//  Literal: the plan (the mapped roof ring: its two long sides give the line and the width). Estimates read from the
//  panorama: the underside 6.5 m over the road, the truss depth 3.0 m, the bay length (≈ 3 m), the pier's place.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { GeoBatch } from '../kit.js';

export const SKYBRIDGE_ID = 'w296789534';

/** the bridge's centre line from the mapped ring: the midpoints across its width at each end and at the bend */
function centreLine(poly) {
    // the ring runs west end → south side → east end → north side; pair each south-side vertex with the nearest north-side one
    let best = null; for (let i = 0; i < poly.length; i++) for (let j = i + 1; j < poly.length; j++) { const d = Math.hypot(poly[i][0] - poly[j][0], poly[i][1] - poly[j][1]); if (!best || d > best.d) best = { i, j, d }; }
    const a = poly[best.i], b = poly[best.j], ux = (b[0] - a[0]) / best.d, uz = (b[1] - a[1]) / best.d;
    // station of every vertex along the long axis; side by the sign of the cross product
    const pts = poly.map(([x, z]) => ({ s: (x - a[0]) * ux + (z - a[1]) * uz, n: -(x - a[0]) * uz + (z - a[1]) * ux, x, z }));
    const left = pts.filter((p) => p.n > 0.3).sort((p, q) => p.s - q.s), right = pts.filter((p) => p.n < -0.3).sort((p, q) => p.s - q.s);
    const width = Math.max(2, (left.reduce((t, p) => t + p.n, 0) / Math.max(1, left.length)) - (right.reduce((t, p) => t + p.n, 0) / Math.max(1, right.length)));
    const sMin = Math.min(...pts.map((p) => p.s)), sMax = Math.max(...pts.map((p) => p.s)), nMid = (Math.max(...pts.map((p) => p.n)) + Math.min(...pts.map((p) => p.n))) / 2;
    return { a: [a[0] + ux * sMin - uz * nMid, a[1] + uz * sMin + ux * nMid], b: [a[0] + ux * sMax - uz * nMid, a[1] + uz * sMax + ux * nMid], width, ux, uz };
}

export function skyBridge(ctx, { roadYAt, pierAt = 0.9 } = {}) {
    const bd = ctx.data.buildings.find((b) => b.id === SKYBRIDGE_ID); if (!bd?.poly) return null;
    const L = centreLine(bd.poly), len = Math.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1]), mid = [(L.a[0] + L.b[0]) / 2, (L.a[1] + L.b[1]) / 2];
    const road = roadYAt ? roadYAt(mid[0], mid[1]) : ctx.ground.heightAt(mid[0], mid[1]);
    const CLEAR = 6.5, DEPTH = 3.0, W = Math.min(L.width, 5.2), deck = road + CLEAR, top = deck + DEPTH, yaw = Math.atan2(L.ux, L.uz);
    const b = new GeoBatch(), green = '#3f8a7c', pale = '#b9d8c4', at = (s, n, y) => [L.a[0] + L.ux * s - L.uz * n, y, L.a[1] + L.uz * s + L.ux * n];
    const P = (s, n) => [L.a[0] + L.ux * s - L.uz * n, L.a[1] + L.uz * s + L.ux * n];
    // deck (dark underside) and roof (flat, a little wider than the trusses)
    { const [x, z] = mid; b.box(x, deck - 0.45, z, W, 0.45, len, '#5d6461', 'concrete', yaw); b.box(x, top, z, W + 0.6, 0.22, len + 0.4, '#d9e3dc', 'paint', yaw); }
    // the two trusses: chords + Warren diagonals + end posts, and the pale panels behind them (the enclosure)
    const bays = Math.max(4, Math.round(len / 3.0)), bl = len / bays;
    for (const side of [-1, 1]) {
        const n = side * (W / 2 - 0.12);
        for (const y of [deck + 0.1, top - 0.15]) b.rod(at(0, n, y), at(len, n, y), 0.16, green, 'metal', 6);
        for (let i = 0; i < bays; i++) { const s0 = i * bl, s1 = s0 + bl, up = i % 2 === 0; b.rod(at(s0, n, up ? deck + 0.1 : top - 0.15), at(s1, n, up ? top - 0.15 : deck + 0.1), 0.11, green, 'metal', 6); }
        for (const s of [0, len]) b.rod(at(s, n, deck), at(s, n, top), 0.14, green, 'metal', 6);
        const [x, z] = P(len / 2, side * (W / 2 - 0.3)); b.box(x, deck + 0.1, z, 0.06, DEPTH - 0.3, len - 0.2, pale, 'paint', yaw);
    }
    // the white concrete pier at the market-side kerb
    { const [x, z] = P(len * pierAt, 0), g0 = ctx.ground.heightAt(x, z); b.box(x, g0, z, 0.9, deck - 0.45 - g0, 0.9, '#e6e3dc', 'concrete', yaw); ctx.box?.(x, z, 0.45, 0.45, yaw); }
    const mesh = b.build('skybridge'); ctx.add(mesh);
    ctx.extras.skyBridge = { sourceId: SKYBRIDGE_ID, length: +len.toFixed(1), width: +W.toFixed(1), deckY: +deck.toFixed(2), clearM: CLEAR, depthM: DEPTH, basis: 'plan from OSM; clearance, truss depth and pier from Street View (estimates)' };
    return ctx.extras.skyBridge;
}
void THREE;
