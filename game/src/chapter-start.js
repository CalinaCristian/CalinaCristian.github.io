// The car pose at a chapter start, from the built road graph.
// One rule for both ways of entering a chapter: a fresh district load (world.spawn, buildWorld "---- spawn") and an
// in-district entry (chapter select / replay / "next chapter" with the district already loaded). The two used different
// rules: the in-district one took the nearest edge of the named road whatever its direction, so a start that lies
// between the two one-way carriageways of a boulevard could land on the opposite carriageway, facing away, where the
// carriageway leaves the map (no route). Keep this file in step with the spawn block in world.js.
import { clamp, distPointSeg } from './util.js';

/**
 * @param edges  world.graph.edges (built edges: a, b, dirx, dirz, nx, nz, len, oneway, drivable, median, laneW…)
 * @param q      the start projected to world metres {x, z}
 * @param st     the chapter start {heading|bearing (compass degrees), road (RegExp), classes (RegExp)}
 * @returns {{x, z, heading, edge, dir, t}|null}
 */
export function chapterStartPose(edges, q, st, { maxR = 1500 } = {}) {
    if (!edges?.length || !q || !st) return null;
    const bearing = st.heading ?? st.bearing ?? null;
    const br = (bearing ?? 0) * Math.PI / 180, wantX = Math.sin(br), wantZ = -Math.cos(br);
    // a one-way carriageway must run the way the chapter faces
    const legalDir = (e) => bearing == null || !e.oneway || e.dirx * wantX + e.dirz * wantZ > 0.2;
    const named = (e) => st.road ? st.road.test(e.name) : true;
    const classOK = (e) => st.classes ? st.classes.test(e.type) : st.road ? true : !/motorway/.test(e.type);
    const nearest = (filter, r) => {
        let best = null;
        for (const e of edges) {
            if (!filter(e)) continue;
            const h = distPointSeg(q.x, q.z, e.a.x, e.a.z, e.b.x, e.b.z);
            if (h.d <= r && (!best || h.d < best.d)) best = { edge: e, d: h.d, t: h.t };
        }
        return best;
    };
    const ne = nearest((e) => e.drivable && legalDir(e) && named(e) && classOK(e) && e.len > 15, maxR) || nearest((e) => e.drivable && e.len > 10, 3000);
    if (!ne) return null;
    const e = ne.edge;
    let dir = (e.dirx * wantX + e.dirz * wantZ) >= 0 ? 1 : -1;
    if (e.oneway) dir = 1;
    const t = clamp(ne.t, 0.15, 0.85);
    const lat = (e.sharedLane ? 0 : ((e.median || 0) / 2 + e.laneW * 0.5) * dir) + (e.laneCenterShiftM || 0);
    return { x: e.a.x + e.dirx * e.len * t + e.nx * lat, z: e.a.z + e.dirz * e.len * t + e.nz * lat, heading: Math.atan2(-e.dirx * dir, -e.dirz * dir), edge: e, dir, t };
}
