// ============================================================================
//  Pioneer Square west end (round 3): the streets, crossings, planted beds,
//  piers, street trees and traffic signals between Western Ave and Elliott Bay
//  (Yesler Way to Alaskan Way, Colman Dock's holding lanes, the Waterfront Trail
//  and Bike Path) from the live OSM snapshot in pioneer-square-westend-data.js.
//  Panoramas fYcy5IxBB8nxBtlHlp0w6w (Yesler at Post Ave, 270°), icoHFzEOnBuL9Tmg_QeZUw
//  (Alaskan Way, 250°), 96BnTtZETD_9PxJd3_oy9w (Alaskan Way at Columbia, 250°) were the
//  look reference: concrete roadways, white zebra crossings, mast-arm signals on grey
//  poles, young street trees, planted beds of grasses. Pole / arm sizes are estimates.
// ============================================================================
import { GeoBatch, distSeg } from '../kit.js';
import { WESTEND } from './pioneer-square-westend-data.js';

const SURF = { concrete: '#8f8c86', asphalt: '#55585b', paved: '#7d7b77', paving_stones: '#8a8178', metal: '#5b5f63' };
export function westEndStreets(ctx) {
    const W = WESTEND, P = ctx.painter, g = ctx.ground, b = new GeoBatch(), out = { roads: 0, crossings: 0, trees: 0, signals: 0, beds: 0 };
    for (const p of W.piers) P.poly(p.poly, p.k === 'pier' ? '#8a8781' : '#9d988f', 'slab');
    for (const a of W.beds) { P.poly(a.poly, a.k === 'flowerbed' ? '#5a5a2c' : '#566330', 'grass'); out.beds++; }
    for (const r of W.roads) { P.line(r.pts, r.w, SURF[r.surface] || (r.k === 'service' ? '#5e6063' : '#55585b'), 'asphalt'); out.roads++; }
    for (const f of W.foot) P.line(f.pts, f.w, f.k === 'cycleway' ? '#4f5255' : SURF[f.surface] || '#a19d94', f.k === 'cycleway' ? 'asphalt' : 'slab');
    for (const c of W.crossings) { P.line(c.pts, 3.0, '#e9e7e0', 'asphalt', { dash: [0.5, 0.6], cap: 'butt' }); out.crossings++; }
    for (const [x, z] of W.trees) { ctx.trees.push({ x, z, kind: 'broad', s: 0.85, keepOnRoad: true }); out.trees++; }
    // traffic signals: a grey pole with a mast arm reaching over the nearest carriageway, three-aspect heads
    for (const [x, z] of W.signals) {
        let best = null; for (const r of W.roads) for (let i = 1; i < r.pts.length; i++) { const q = distSeg(x, z, r.pts[i - 1][0], r.pts[i - 1][1], r.pts[i][0], r.pts[i][1]); if (!best || q.d < best.d) best = { ...q, w: r.w }; }
        let dx = 0, dz = 1; if (best && best.d > 0.5) { dx = (best.cx - x) / best.d; dz = (best.cz - z) / best.d; }
        const px = x - dx * 1.5, pz = z - dz * 1.5, y = g.heightAt(px, pz), H = 6.6, arm = Math.min(9, Math.max(4, (best?.d || 4) + 1.5));
        b.cyl(px, y, pz, 0.16, H, '#5d6266', 'metal', 10);
        b.rod([px, y + H - 0.4, pz], [px + dx * arm, y + H - 0.4, pz + dz * arm], 0.08, '#5d6266', 'metal', 6);
        for (const t of [0.55, 0.95]) { const hx = px + dx * arm * t, hz = pz + dz * arm * t; b.box(hx, y + H - 1.55, hz, 0.36, 1.05, 0.3, '#1d1f21', 'metal', Math.atan2(dx, dz)); }
        b.box(px + dx * 0.25, y + 2.6, pz + dz * 0.25, 0.3, 0.6, 0.25, '#1d1f21', 'metal', Math.atan2(dx, dz)); // pedestrian head
        ctx.circle(px, pz, 0.2, H); out.signals++;
    }
    ctx.add(b.build('westend-signals'));
    return out;
}
