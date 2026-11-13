// Oval (œil-de-bœuf) dormers on a reviewed mansard roof. Used by building-review.js rows with `dormers` (r3-landmarks-3,
// Casa Filipescu-Cesianu: a dark slate mansard with oval dormers seen from Calea Victoriei / Str. Sevastopol). OSM has no
// dormer data (no roof:dormers / roof:windows on the way), so the dormers are a class: one per `spacingM` along every face
// long enough, set back `setbackM` from the wall line on the lower slope. Estimates, stated: spacing, size, set-back.
export const OVAL_DORMER_MODEL = { spacingM: 3.6, widthM: 1.15, heightM: 1.5, setbackM: 0.35, cornerM: 1.6, estimates: ['spacingM', 'widthM', 'heightM', 'setbackM', 'cornerM'] };

/**
 * Emit the dormers of one building. ring: footprint (x, z) in any winding; eavesM: roof profile eaves height; heightAt(x, z):
 * roof surface height; box(x, y, z, w, h, d, rot, col) and ellipsoid(x, y, z, rot, sx, sy, sz, col) emit geometry (rot turns the
 * local +z axis to the dormer's inward direction). cols = { wall, slate, glass }. Returns the number of dormers.
 */
export function emitOvalDormers({ ring, eavesM, heightAt, box, ellipsoid, cols, model = OVAL_DORMER_MODEL }) {
    const M = model; let n = 0;
    const area = ring.reduce((s, v, i) => { const w = ring[(i + 1) % ring.length]; return s + v[0] * w[1] - w[0] * v[1]; }, 0) / 2, sg = area > 0 ? 1 : -1;
    for (let k = 0; k < ring.length; k++) {
        const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % ring.length], L = Math.hypot(bx - ax, bz - az);
        if (L < M.cornerM * 2 + M.widthM) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L, nx = -uz * sg, nz = ux * sg; // inward normal (left of a ccw edge)
        const count = Math.max(1, Math.floor((L - M.cornerM * 2) / M.spacingM) + 1), step = count > 1 ? (L - M.cornerM * 2) / (count - 1) : 0;
        const rot = Math.atan2(nx, nz), y0 = eavesM + 0.1, y1 = y0 + M.heightM;
        for (let i = 0; i < count; i++) {
            const s = count > 1 ? M.cornerM + step * i : L / 2, px = ax + ux * s, pz = az + uz * s;
            // depth: from the front (set back from the wall) inward until the slope has risen above the dormer top
            let depth = 0.6; while (depth < 3.5 && heightAt(px + nx * (M.setbackM + depth), pz + nz * (M.setbackM + depth)) < y1 + 0.35) depth += 0.25;
            if (heightAt(px + nx * M.setbackM, pz + nz * M.setbackM) > y1 - 0.2) continue; // (the slope is already above the dormer: not a lower slope here)
            const cx = px + nx * (M.setbackM + depth / 2), cz = pz + nz * (M.setbackM + depth / 2);
            box(cx, y0, cz, M.widthM, M.heightM, depth, rot, cols.wall);
            ellipsoid(cx, y1, cz, rot, M.widthM * 0.56, 0.42, depth / 2, cols.slate); // rounded hood
            const fx = px + nx * (M.setbackM - 0.02), fz = pz + nz * (M.setbackM - 0.02);
            ellipsoid(fx, y0 + M.heightM * 0.52, fz, rot, M.widthM * 0.3, M.heightM * 0.3, 0.05, cols.glass); // the oval window
            n++;
        }
    }
    return n;
}
