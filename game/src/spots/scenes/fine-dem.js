// ============================================================================
//  Fine terrain for a scene whose research grid (20 m) is too coarse where the
//  levels matter: lock walls and banks, a viewpoint platform on a shore, the
//  embankment under a bridge end. The data modules `fine-dem-<scene>.js` hold
//  USGS 3DEP 1 m samples on a 4–5 m grid (see their headers).
// ============================================================================
import { smooth } from '../kit.js';

/** bilinear sampler over a fine grid: (x, z) → metres above the scene origin, or null outside the grid */
export function fineDemSampler(grid) {
    const { x0, z0, d, nx, nz, h, unit = 0.01 } = grid;
    const at = (x, z) => {
        const fx = (x - x0) / d, fz = (z - z0) / d;
        if (fx < 0 || fz < 0 || fx > nx - 1 || fz > nz - 1) return null;
        const i = Math.min(nx - 2, Math.floor(fx)), j = Math.min(nz - 2, Math.floor(fz)), u = fx - i, v = fz - j, k = j * nx + i;
        return ((h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + nx] * (1 - u) + h[k + nx + 1] * u) * v) * unit;
    };
    /** nearest sample (no interpolation): for flat hydro-flattened water values */
    at.nearest = (x, z) => {
        const i = Math.round((x - x0) / d), j = Math.round((z - z0) / d);
        return i < 0 || j < 0 || i >= nx || j >= nz ? null : h[j * nx + i] * unit;
    };
    at.box = { x0, z0, x1: x0 + (nx - 1) * d, z1: z0 + (nz - 1) * d };
    return at;
}

/**
 * Replace the coarse terrain by the fine grid inside its box, blended back to the scene terrain over `fade` m at the
 * box edge. Call it before the scene's own ground shaping (flatten / corridor / mod), which then works on real levels.
 */
export function applyFineDem(ground, grid, { fade = 10 } = {}) {
    const at = fineDemSampler(grid), b = at.box;
    ground.mod((x, z, h) => {
        const f = at(x, z); if (f === null) return h;
        const edge = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
        return edge >= fade ? f : h + (f - h) * smooth(0, fade, edge);
    });
    return at;
}
