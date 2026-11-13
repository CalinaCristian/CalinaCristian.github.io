// ============================================================================
//  A small playground on a mapped `leisure=playground` area whose equipment is not mapped (Occidental Square w1155308011,
//  Pier 58 w1417461575): rubber surfacing painted over the area, a climbing tower with a slide and a two-seat swing frame
//  placed inside it, facing its longest side. Equipment, sizes and colours are generic estimates; only the area is OSM.
// ============================================================================
import { GeoBatch, inPoly, polyBox, obb } from './kit.js';

/** builds the kit into ctx; returns { pieces } (0 when the area is too small for a piece) */
export function playgroundKit(ctx, poly, { surface = '#3f6b5a', tower = '#d9442b', frame = '#2f5d8a', y = null, name = 'playground-kit' } = {}) {
    if (!poly || poly.length < 3) return { pieces: 0 };
    const g = ctx.ground, o = obb(poly); if (!o) return { pieces: 0 };
    let ux = o.ux, uz = o.uz, hl = o.len / 2, hw = o.wid / 2; if (o.wid > o.len) { [ux, uz] = [-uz, ux]; hl = o.wid / 2; hw = o.len / 2; }
    const vx = -uz, vz = ux, yaw = Math.atan2(ux, uz), P = (u, v) => [o.cx + ux * u + vx * v, o.cz + uz * u + vz * v];
    const at = (x, z) => y ?? g.heightAt(x, z), ok = (x, z, r) => [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([a, b]) => inPoly(x + a, z + b, poly));
    const b = new GeoBatch(); let pieces = 0;
    // poured rubber surfacing: painted on the terrain, or a sheet on a deck (y given: a pier deck covers the terrain)
    if (y === null) ctx.painter.poly(poly, surface, 'slab'); else b.flat(poly, y + 0.035, surface, 'concrete');
    // climbing tower (2.4 m square deck at 1.5 m, four posts, a pitched roof) with a slide off its long-axis side
    { const [x, z] = P(-hl * 0.35, 0); if (hl > 3 && hw > 2 && ok(x, z, 2)) { const y0 = at(x, z);
        for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const px = x + (ux * a + vx * c) * 1.1, pz = z + (uz * a + vz * c) * 1.1; b.box(px, y0, pz, 0.12, 3.2, 0.12, frame, 'paint', yaw); }
        b.box(x, y0 + 1.45, z, 2.4, 0.1, 2.4, '#b88a55', 'wood', yaw);
        b.boxC(x + ux * 0.62, y0 + 3.35, z + uz * 0.62, 2.6, 0.08, 1.5, tower, 'paint', yaw, 0.55); b.boxC(x - ux * 0.62, y0 + 3.35, z - uz * 0.62, 2.6, 0.08, 1.5, tower, 'paint', yaw, -0.55);
        const sx = x + ux * 2.3, sz = z + uz * 2.3; b.boxC(sx, y0 + 0.78, sz, 0.7, 0.06, 2.6, '#f2c230', 'paint', yaw, -0.62); // slide chute (down the long axis)
        ctx.box(x, z, 1.3, 1.3, yaw, { prop: true, h: 3.4 }); pieces++; } }
    // swing frame (A-frames 2.4 m high, 3.2 m beam) on the other half
    { const [x, z] = P(hl * 0.4, 0); if (hl > 3 && hw > 1.5 && ok(x, z, 1.8)) { const y0 = at(x, z);
        for (const s of [-1.6, 1.6]) for (const t of [-1, 1]) { const px = x + vx * s, pz = z + vz * s; b.rod([px + ux * t * 0.8, y0, pz + uz * t * 0.8], [px, y0 + 2.4, pz], 0.05, frame, 'paint', 6); }
        b.rod([x - vx * 1.6, y0 + 2.4, z - vz * 1.6], [x + vx * 1.6, y0 + 2.4, z + vz * 1.6], 0.055, frame, 'paint', 6);
        for (const s of [-0.7, 0.7]) { const px = x + vx * s, pz = z + vz * s; for (const t of [-0.22, 0.22]) b.rod([px + vx * t, y0 + 2.38, pz + vz * t], [px + vx * t, y0 + 0.5, pz + vz * t], 0.008, '#8a8f93', 'steel', 3); b.box(px, y0 + 0.45, pz, 0.5, 0.05, 0.22, '#222426', 'paint', yaw + Math.PI / 2); }
        ctx.box(x, z, 0.3, 1.8, yaw, { prop: true, h: 2.4 }); pieces++; } }
    if (b.parts.size) ctx.add(b.build(name));
    return { pieces, box: polyBox(poly) };
}
