// ============================================================================
//  GROUND REVIEW — places where the street-level review found the ground paved although the aerial green raster
//  (data.green) marks grass cells there and OSM has no surface polygon (fidelity pass round 2, 2026-11-12).
//
//  A row is a ring (lat, lon) drawn round the open carriageway area of a square, between its outer kerbs. Inside it
//  the green raster's cells are not drawn; nothing else changes: OSM grass / park polygons, trees, roads and parking
//  areas inside the ring stay as the district data has them. Never used to remove a mapped green.
// ============================================================================

import { PEDESTRIAN_FRONTS } from './pedestrian-fronts.js';
import { PEDESTRIAN_PLAZAS } from './pedestrian-plazas.js';

// (Old Town, Unirii: panoramas at 44.430444, 26.102414 and 44.431796, 26.102087 show cobbled pedestrian streets wall to
// wall; the raster marked them as lawn) mapped OSM highway=pedestrian ways are paved: a band of this half-width round
// their centre line is kept free of raster grass. Mapped grass / park polygons are not affected.
export const PEDESTRIAN_PAVED_HALF_M = 3.5;

// (r3-look-14, 2026-11-13) a mapped pedestrian plaza (highway=pedestrian|footway area=yes, area:highway, place=square;
// pedestrian-plazas.js, live OSM) is paved over its whole polygon: OSM's `surface` decides, and no surface tag counts as
// paved; only `surface=grass` keeps the raster's lawn. The 3.5 m band above covered only the plaza's outline, so the
// raster's green cells inside it stayed (Romană, Piața Revoluției). Mapped grass / park polygons inside are not affected.
export const plazaPaved = (row) => row[1] !== 'grass';

export const PAVED_REVIEW = {
    'bucharest-romana': [
        { name: 'Piața Victoriei', note: 'panorama at 44.452163, 26.085980: asphalt in every direction (carriageways and the car park), no lawn islands; the raster cells there are tree shade / markings',
          ring: [[44.453069, 26.084153], [44.453069, 26.086418], [44.452349, 26.086418], [44.452349, 26.086732], [44.451764, 26.086732], [44.451764, 26.084153]] },
    ],
};

// rings in world coordinates, in the shape the green raster's row mask takes ({ z0, z1, rings })
export function pavedReviewAreas(key, project) {
    const bands = [];
    for (const [id, ped, pts] of PEDESTRIAN_FRONTS[key] || []) {
        if (!ped) continue; const P = pts.map(([la, lo]) => { const q = project(la, lo); return [q.x, q.z]; });
        for (let i = 0; i + 1 < P.length; i++) {
            const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < .2) continue;
            const h = PEDESTRIAN_PAVED_HALF_M, ux = (bx - ax) / L * h, uz = (bz - az) / L * h, nx = -uz, nz = ux;
            const ring = [[ax - ux + nx, az - uz + nz], [bx + ux + nx, bz + uz + nz], [bx + ux - nx, bz + uz - nz], [ax - ux - nx, az - uz - nz]];
            bands.push({ kind: 'paved-pedestrian', sourceId: 'w' + id, rings: [ring], z0: Math.min(...ring.map(p => p[1])), z1: Math.max(...ring.map(p => p[1])) });
        }
    }
    for (const row of PEDESTRIAN_PLAZAS[key] || []) {
        if (!plazaPaved(row)) continue;
        const rings = row[4].map(r => r.map(([la, lo]) => { const q = project(la, lo); return [q.x, q.z]; })), zs = rings.flat().map(p => p[1]);
        bands.push({ kind: 'paved-plaza', sourceId: row[0], rings, z0: Math.min(...zs), z1: Math.max(...zs) });
    }
    return bands.concat((PAVED_REVIEW[key] || []).map(row => {
        const ring = row.ring.map(([lat, lon]) => { const q = project(lat, lon); return [q.x, q.z]; });
        return { kind: 'paved-review', name: row.name, rings: [ring], z0: Math.min(...ring.map(p => p[1])), z1: Math.max(...ring.map(p => p[1])) };
    }));
}
