// L34: a mapped canopy (building=roof: market arcades, fuel stations, shelters) stands on posts along its free edges.
// The native source plan (osm.js, hashed into the Seattle context cache, so not edited) draws only the slab, which read
// as a dark ceiling floating over Pike Place. No post inside or against another building: there the canopy hangs from
// that wall. Post size and spacing are estimates; positions come from the OSM outline.
import { GeoBatch, inPoly, polyBox, distPolyline } from './kit.js';
import { polyCollider } from './osm.js';

export function canopyPosts(data, ground, members, { skip = new Set(), spacing = 6.5, color = '#3e4446' } = {}) {
    const roofs = new Set(data.buildings.filter((b) => b.k === 'roof' && !(Number(b.layer) < 0)).map((b) => b.id));
    const canopies = (members || []).filter((m) => roofs.has(m.source) && !m.residual && m.minHeight > -1e3);
    const out = { group: null, colliders: [], posts: 0 };
    if (!canopies.length) return out;
    const solids = data.buildings.filter((b) => b.k !== 'roof' && b.poly?.length >= 3 && !skip.has(b.id)).map((b) => ({ poly: b.poly, ring: [...b.poly, b.poly[0]], bb: b._bb || (b._bb = polyBox(b.poly)) }));
    const nearSolid = (x, z) => solids.some((s) => x > s.bb.x0 - 0.7 && x < s.bb.x1 + 0.7 && z > s.bb.z0 - 0.7 && z < s.bb.z1 + 0.7 && (inPoly(x, z, s.poly) || distPolyline(x, z, s.ring).d < 0.7));
    const b = new GeoBatch();
    for (const m of canopies) {
        const ring = m.footprint, N = ring.length, cand = [];
        // a canopy with a mapped solid standing under it (the legs of a pavilion such as Bellevue's Piloti) is carried by it
        if (solids.some((s) => inPoly((s.bb.x0 + s.bb.x1) / 2, (s.bb.z0 + s.bb.z1) / 2, ring) && s.poly.every(([x, z]) => inPoly(x, z, ring) || distPolyline(x, z, [...ring, ring[0]]).d < 0.5))) continue;
        // stations along the whole outline: every corner sharper than 35° and every `spacing` m between them (a round
        // canopy drawn with 90 vertices gets posts by distance, not one per vertex)
        const turn = (i) => { const p = ring[(i + N - 1) % N], q = ring[i], r = ring[(i + 1) % N], a = Math.atan2(q[1] - p[1], q[0] - p[0]), c = Math.atan2(r[1] - q[1], r[0] - q[0]); return Math.abs(Math.atan2(Math.sin(c - a), Math.cos(c - a))); };
        let since = Infinity;
        for (let i = 0; i < N; i++) {
            const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % N], L = Math.hypot(bx - ax, bz - az);
            if (turn(i) > 0.6 && since > 2) { cand.push([ax, az]); since = 0; }
            for (let s = Math.max(0, spacing - since); s < L; s += spacing) { if (L - s < 2 && turn((i + 1) % N) > 0.6) break; cand.push([ax + (bx - ax) * s / L, az + (bz - az) * s / L]); since = -s; }
            since += L;
        }
        for (const [x, z] of cand) {
            const g0 = ground.heightAt(x, z), h = m.minHeight - g0;
            // (2–9 m clear of the ground: lower ones are kiosk roofs on walls, higher ones bridges and decks)
            if (h < 2 || h > 9 || nearSolid(x, z)) continue;
            b.cyl(x, g0, z, 0.09, h, color, 'metal', 8);
            out.colliders.push({ ...polyCollider([[x - 0.12, z - 0.12], [x + 0.12, z - 0.12], [x + 0.12, z + 0.12], [x - 0.12, z + 0.12]], g0, m.minHeight), source: m.source, post: true });
            out.posts++;
        }
    }
    if (out.posts) out.group = b.build('canopy-posts');
    return out;
}
