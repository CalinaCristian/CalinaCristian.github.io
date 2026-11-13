// ============================================================================
//  Parked cars on mapped surface car parks (Bucharest spot scenes).
//  Positions come only from OSM: an amenity=parking area and the parking_aisle
//  ways inside it. Cars stand side by side on both sides of each aisle, nose to
//  the aisle (the bay layout itself is not mapped: perpendicular bays are an
//  estimate), wholly inside the parking outline, off buildings, lawns and every
//  other mapped way (footways crossing a car park stay open).
//  Kinds follow the city's fleet mix, without the trucks and long delivery vans that do not fit a 4.8 m bay.
//  → [{ x, z, yaw, kind, source }] for addTraffic({ parked, merge: true }).
// ============================================================================
import { rng, inPoly, distPolyline } from '../kit.js';
import * as THREE from '../../../vendor/three.module.min.js';
import { pickFleetKind, makeVehicle } from '../../vehicles.js';

// a model's origin is not the middle of its body: the local box centre per kind, so each car sits in the middle of its bay
const CENTRE = new Map();
function bodyCentre(kind, city) { if (!CENTRE.has(kind)) { const v = makeVehicle(kind, '#888888', { city }), b = new THREE.Box3().setFromObject(v); CENTRE.set(kind, [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2]); v.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); }); } return CENTRE.get(kind); }

const KEEP_CLEAR = { footway: 1.6, path: 1.6, pedestrian: 2, steps: 1.6, cycleway: 1.4, service: 3.2, residential: 4, tertiary: 5, secondary: 6, primary: 7, living_street: 3.5, unclassified: 4 };

export function aisleParking(ctx, areaIds, { bay = 2.5, depth = 4.8, aisleHalf = 3, fill = 0.88, seed = 23, clear = null } = {}) {
    const d = ctx.data, r = rng(seed), out = [], taken = [];
    const areas = areaIds.map((id) => d.areas.find((a) => a.id === id)).filter((a) => a?.poly?.length > 2);
    const aisles = d.ways.filter((w) => w.k === 'service' && w.service === 'parking_aisle' && w.pts.length > 1);
    const others = d.ways.filter((w) => KEEP_CLEAR[w.k] && !(w.k === 'service' && w.service === 'parking_aisle') && !w.tunnel && !w.layer);
    const blds = d.buildings.filter((b) => !b.part && b.poly?.length > 2 && !(+b.minH > 2));
    const green = d.areas.filter((a) => a.poly?.length > 2 && (/^(grass|flowerbed|meadow)$/.test(a.landuse || '') || /^(garden|park)$/.test(a.leisure || '') || /^(scrub|grassland)$/.test(a.natural || '')));
    const free = (x, z) => !others.some((w) => distPolyline(x, z, w.pts).d < KEEP_CLEAR[w.k]) && !blds.some((b) => inPoly(x, z, b.poly)) && !green.some((a) => inPoly(x, z, a.poly)) && !(clear && clear(x, z));
    for (const a of areas) {
        for (const w of aisles) {
            const mid = w.pts[Math.floor(w.pts.length / 2)]; if (!w.pts.some(([x, z]) => inPoly(x, z, a.poly)) && !inPoly(mid[0], mid[1], a.poly)) continue;
            for (let i = 1; i < w.pts.length; i++) {
                const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < bay) continue;
                const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux;
                for (const s of [-1, 1]) for (let u = bay / 2; u <= L - bay / 2; u += bay) {
                    const off = aisleHalf + depth / 2, x = ax + ux * u + nx * s * off, z = az + uz * u + nz * s * off;
                    const corners = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([p, q]) => [x + ux * p * bay * 0.42 + nx * s * q * depth * 0.5, z + uz * p * bay * 0.42 + nz * s * q * depth * 0.5]);
                    if (!corners.every(([cx, cz]) => inPoly(cx, cz, a.poly))) continue;
                    if (!free(x, z) || !corners.every(([cx, cz]) => free(cx, cz))) continue;
                    // no two bays overlap (rows of neighbouring aisles, aisle bends): separating-axis test on 4.9 × 2.3 m boxes
                    const ax2 = nx * s, az2 = nz * s, hit = taken.some(([tx, tz, qx, qz]) => { const dx = tx - x, dz = tz - z; for (const [lx, lz] of [[ax2, az2], [-az2, ax2], [qx, qz], [-qz, qx]]) { const ra = 2.45 * Math.abs(lx * ax2 + lz * az2) + 1.15 * Math.abs(lx * -az2 + lz * ax2), rb = 2.45 * Math.abs(lx * qx + lz * qz) + 1.15 * Math.abs(lx * -qz + lz * qx); if (Math.abs(dx * lx + dz * lz) > ra + rb) return false; } return true; });
                    if (hit) continue;
                    taken.push([x, z, ax2, az2]); if (r() > fill) continue;
                    let kind = pickFleetKind(d.city || 'bucharest', r); for (let k = 0; k < 8 && /truck|delivery/.test(kind); k++) kind = pickFleetKind(d.city || 'bucharest', r); if (/truck|delivery/.test(kind)) kind = 'hatch';
                    const yaw = Math.atan2(nx * s, nz * s) + (r() - 0.5) * 0.06 + (r() < 0.5 ? Math.PI : 0), [cx0, cz0] = bodyCentre(kind, d.city || 'bucharest'), sy = Math.sin(yaw), cy = Math.cos(yaw);
                    out.push({ x: x - (cx0 * cy + cz0 * sy), z: z - (-cx0 * sy + cz0 * cy), yaw, kind, source: a.id });
                }
            }
        }
    }
    return out;
}
