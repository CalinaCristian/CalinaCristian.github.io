// ============================================================================
//  SIDEWALK OVERLAP — no inferred walkway on a link lane that runs inside another carriageway
//  (fidelity pass round 3, 2026-11-13; bellevue-3).
//
//  An OSM way without sidewalk tags gets the inferred fallback walkway on both sides (sidewalk-source.js). For a turn
//  lane / ramp (`*_link`) mapped in the median of a dual carriageway, that band lies on the carriageways either side,
//  and the crowd walks it: on Bellevue's NE 8th St east of I-405 every pedestrian in reach walked in a column down the
//  median (w1548748925 / w1548748924, the left-turn lanes between the two one-way halves, whose own sidewalks are
//  mapped `sidewalk=separate`). Rule: an at-grade `*_link` edge whose sides carry no source tag loses the inferred
//  walkway on a side where another at-grade carriageway runs parallel closer than the link's width + that walkway.
//  Source-tagged sides, lane widths and positions never change; nothing else is touched.
// ============================================================================
import { distPointSeg } from './util.js';

/** edges: the district's edges after sourceSidewalkSides; edgesInBox(x0, z0, x1, z1, cb); shoulderOf(e). Returns an audit. */
export function dropMedianLinkSidewalks(edges, edgesInBox, shoulderOf) {
    const audit = { rule: 'inferred walkway removed on *_link sides overlapping a parallel at-grade carriageway', edges: [] };
    const flat = e => Math.max(Math.abs(e.ya || 0), Math.abs(e.yb || 0)) < .3;
    // a link whose every connecting road at both ends is source-tagged with no walkway on either side (sidewalk=no /
    // separate) inherits that: its own inferred walkway would be the only one in the middle of those roads
    const roadsAt = (n, e) => (n?.allEdges || n?.edges || []).filter(f => f !== e && !/_link$/.test(f.type || '') && !f.virtual);
    const bare = f => f.sidewalkSource?.explicit && !(f.sidewalkRightM > 0) && !(f.sidewalkLeftM > 0);
    for (const e of edges) {
        if (!/_link$/.test(e.type || '') || e.virtual || e.tunnel || e.bridge || !flat(e) || e.sidewalkSource?.explicit) continue;
        const ends = [...roadsAt(e.a, e), ...roadsAt(e.b, e)];
        if (ends.length && ends.every(bare) && (e.sidewalkRightM > 0 || e.sidewalkLeftM > 0)) {
            e.sidewalkRightM = 0; e.sidewalkLeftM = 0; audit.edges.push({ sourceId: e.sidewalkSource?.sourceId || null, side: 'both', basis: 'connecting roads are tagged without walkways' }); continue;
        }
        for (const sd of [1, -1]) {
            const key = sd > 0 ? 'sidewalkRightM' : 'sidewalkLeftM', sw = e[key]; if (!(sw > 0)) continue;
            const have = (sd > 0 ? e.wR : e.wL) + sw;
            let hit = null;
            for (const t of [.25, .5, .75]) {
                const x = e.a.x + (e.b.x - e.a.x) * t, z = e.a.z + (e.b.z - e.a.z) * t;
                // the middle of the walkway band on this side (a short diagonal connector is not parallel to anything)
                const off = (sd > 0 ? e.wR : e.wL) + sw / 2, px = x + e.nx * off * sd, pz = z + e.nz * off * sd;
                edgesInBox(x - 16, z - 16, x + 16, z + 16, f => {
                    if (hit || f === e || f.virtual || f.tunnel || f.bridge || !f.drivable || !flat(f)) return;
                    const p = distPointSeg(px, pz, f.a.x, f.a.z, f.b.x, f.b.z);
                    if (p.d < (((px - p.cx) * f.nx + (pz - p.cz) * f.nz) > 0 ? f.wR : f.wL)) { hit = f; return; } // (the band lies on that carriageway)
                    if (Math.abs(f.dirx * e.dirx + f.dirz * e.dirz) < .9) return;
                    const q = distPointSeg(x, z, f.a.x, f.a.z, f.b.x, f.b.z); if (q.t <= .02 || q.t >= .98) return;
                    if (((q.cx - x) * e.nx + (q.cz - z) * e.nz) * sd <= 0) return; // (on this side)
                    const fSide = ((x - q.cx) * f.nx + (z - q.cz) * f.nz) > 0 ? f.wR : f.wL;
                    if (q.d - fSide - shoulderOf(f) < have - .05) hit = f;
                });
                if (hit) break;
            }
            if (!hit) continue;
            e[key] = 0; audit.edges.push({ sourceId: e.sidewalkSource?.sourceId || null, side: sd > 0 ? 'right' : 'left', overlaps: hit.road ?? null });
        }
    }
    return audit;
}
