// ============================================================================
//  Seattle Waterfront — the shoreline as OpenStreetMap maps it.
//  Source: the `natural=coastline` ways of the spot extract (members of the Elliott Bay relation 13316235; checked
//  against the live database on 2026-11-12: unchanged). They run from Pier 62 south to Pier 54 with the land on their
//  left: the straight seawall, and around each pier (Piers 62, 60, 59, 58, 57, 56, 55, 54). Two mapped `natural=water`
//  pockets lie behind that line: the cove between the rebuilt Pier 58 and the seawall (way 1417461574) and the
//  basin between Piers 59 and 60 (way 776848804).
//  Before, the land was "wherever the 20 m elevation grid is above 0.2 m": rounded blobs of ground around the piers,
//  ground under open water and pools in the promenade. Now the ground is cut exactly along the mapped line, with a
//  seawall / pier-skirt face down to the water.
//  The extract stores the relation as its member ways one after the other (each way ends where the one before it
//  starts), not as one ring: `coastline()` puts them back in order.
// ============================================================================
import * as THREE from '../../../vendor/three.module.min.js';
import { inPoly, polyBox } from '../kit.js';

const BAY = 'r13316235', POCKETS = ['w1417461574', 'w776848804'];
const same = (a, b) => Math.abs(a[0] - b[0]) < 0.06 && Math.abs(a[1] - b[1]) < 0.06;

/** the coastline north → south (land on the left), from the extract's relation polygon */
export function coastline(data) {
    const src = data.areas.find((a) => a.id === BAY); if (!src) return null;
    const p = src.poly.filter((q, i, l) => i === 0 || !same(q, l[i - 1]));
    // a member way starts at a point that is met again later (the end of the next member)
    const starts = new Set(), ends = new Set(); for (let a = 0; a < p.length; a++) for (let b = a + 2; b < p.length; b++) if (same(p[a], p[b])) { starts.add(a); ends.add(b); break; }
    const runs = []; let cur = [];
    p.forEach((q, i) => { if (starts.has(i) && cur.length) { runs.push(cur); cur = []; } cur.push(q); if (ends.has(i)) { runs.push(cur); cur = []; } });
    if (cur.length) runs.push(cur);
    const chain = []; for (const r of runs.reverse()) for (const q of r) if (!chain.length || !same(q, chain[chain.length - 1])) chain.push(q);
    return chain;
}

// Sutherland–Hodgman against an axis box
function clipBox(poly, b) {
    const cut = (pts, inside, hit) => { const out = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length], ia = inside(a), ic = inside(c); if (ia) out.push(a); if (ia !== ic) out.push(hit(a, c)); } return out; };
    const atX = (x) => (a, c) => [x, a[1] + (c[1] - a[1]) * (x - a[0]) / (c[0] - a[0])], atZ = (z) => (a, c) => [a[0] + (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]), z];
    let q = cut(poly, (a) => a[0] >= b.x0, atX(b.x0)); q = cut(q, (a) => a[0] <= b.x1, atX(b.x1)); q = cut(q, (a) => a[1] >= b.z0, atZ(b.z0)); q = cut(q, (a) => a[1] <= b.z1, atZ(b.z1));
    q = q.filter((a, i, l) => !same(a, l[(i + 1) % l.length]));
    // drop points that lie on the straight line between their neighbours (clipping leaves them along the box edge)
    return q.filter((a, i, l) => { const p = l[(i + l.length - 1) % l.length], n = l[(i + 1) % l.length]; return Math.abs((a[0] - p[0]) * (n[1] - p[1]) - (a[1] - p[1]) * (n[0] - p[0])) > 1e-3; });
}

/**
 * @param box the terrain's inner box (the ground is cut exactly inside it)
 * @returns {{ chain, isWater(x,z), cutouts: number[][][], walls(batch, top, bottom, isPier) }}
 */
export function buildShore(data, box) {
    const chain = coastline(data); if (!chain || chain.length < 8) return null;
    // beyond the extract the shore keeps its general line: north-west past Pier 62, south-east past Pier 54
    const a = chain[0], b = chain[chain.length - 1], far = 4000;
    const north = [a[0] - 0.69 * far, a[1] - 0.72 * far], south = [b[0] + 0.576 * far, b[1] + 0.817 * far];
    const land = [north, ...chain, south, [south[0] + far, south[1]], [north[0] + 2 * far, north[1]]], lb = polyBox(chain);
    const pockets = POCKETS.map((id) => data.areas.find((q) => q.id === id)?.poly).filter(Boolean), pb = pockets.map(polyBox);
    const isWater = (x, z) => {
        for (let i = 0; i < pockets.length; i++) { const q = pb[i]; if (x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1 && inPoly(x, z, pockets[i])) return true; }
        if (x > lb.x1 + 1 && z < lb.z1 && z > lb.z0) return false; // east of every pier: land, no polygon test needed
        return !inPoly(x, z, land);
    };
    const bay = clipBox([north, ...chain, south, [south[0] - 2 * far, south[1] + far], [north[0] - far, north[1] + far]], box);
    const cutouts = [bay, ...pockets].filter((q) => q.length > 2);
    /** vertical faces along the water's edge (two-sided: the pockets' rings are not oriented) */
    const walls = (batch, top, bottom, isPier) => {
        const onBox = (p, q) => (Math.abs(p[0] - q[0]) < 0.01 && (Math.abs(p[0] - box.x0) < 0.01 || Math.abs(p[0] - box.x1) < 0.01)) || (Math.abs(p[1] - q[1]) < 0.01 && (Math.abs(p[1] - box.z0) < 0.01 || Math.abs(p[1] - box.z1) < 0.01));
        for (const ring of cutouts) for (let i = 0; i < ring.length; i++) {
            const p = ring[i], q = ring[(i + 1) % ring.length]; if (onBox(p, q) || same(p, q)) continue;
            const L = Math.hypot(q[0] - p[0], q[1] - p[1]), nx = (q[1] - p[1]) / L * 0.6, nz = -(q[0] - p[0]) / L * 0.6, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
            const pier = isPier(mx + nx, mz + nz) || isPier(mx - nx, mz - nz), col = pier ? '#3f342a' : '#8f8c85', key = pier ? 'wood' : 'concrete', yt = pier ? top - 0.6 : top; // under a pier the deck's own edge band covers the top 0.6 m
            const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([p[0], bottom, p[1], q[0], bottom, q[1], q[0], yt, q[1], p[0], yt, p[1]], 3)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
            batch.add(g, key, null, col, { side: THREE.DoubleSide }); g.dispose();
        }
    };
    return { chain, isWater, cutouts, walls };
}
