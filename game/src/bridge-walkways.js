// ============================================================================
//  BRIDGE WALKWAYS — a sidewalk OSM maps as its own footway on a raised deck gets its strip on that deck.
//  OSM `highway=footway` + `footway=sidewalk` + `bridge=yes` beside a raised carriageway whose side is tagged
//  `sidewalk:<side>=separate`: the carriageway alone would fill the deck from parapet to parapet. The carriageway keeps
//  its lanes; the side the footway runs beside gets a raised walkway of the footway's width, the deck (fascia, underside,
//  piers) is widened outward by it and the deck's railing stands on its outer edge (world-facades-guards.js), across its
//  end too where the next carriageway has none. Raised approach ramps the footway reaches get it too, so the walkway
//  comes down to the street. The crowd walks it at its level (world.deckWalkLevel, p.deckY).
//  Rows: reviewed footways per district pack (© OpenStreetMap contributors, ODbL; nodes are the literal lat / lon of
//  the way). OSM tags no width on them: widthM is an ESTIMATE measured on aerial imagery (district dossier in
//  game/research/). Report: world.stats.bridgeWalkways.
// ============================================================================

const BRIDGE_WALKWAYS = {
    'seattle-bellevue': [
        // NE 8th St over I-405, north side (beside the westbound carriageway and the Exit → Renton lane on the deck)
        { id: 'w67144854', tags: { bridge: 'yes', footway: 'sidewalk', highway: 'footway', layer: '1', surface: 'concrete' }, widthM: 1.8,
          nodes: [[47.6174812, -122.1878999], [47.6174753, -122.1880786], [47.6174886, -122.189379], [47.6174953, -122.1894673]] },
        // NE 8th St over I-405, south side (beside the eastbound carriageway)
        { id: 'w111869523', tags: { bridge: 'yes', footway: 'sidewalk', highway: 'footway', layer: '1', surface: 'concrete' }, widthM: 1.8,
          nodes: [[47.6171829, -122.1894834], [47.6171842, -122.1893933], [47.6171679, -122.1879186]] },
    ],
};

const REACH_M = 4.5; // the footway lies within this of the carriageway's outer asphalt edge (either way: the game's lanes are estimates)
const PARALLEL = .85; // |cos| between the footway and the carriageway

/** Gives every raised carriageway side a footway of BRIDGE_WALKWAYS runs beside its sidewalk width and marks the side
 *  (e.deckWalk = { 1 | -1: widthM, footway }). Each 1 m sample of the footway picks the raised carriageway whose outer
 *  asphalt edge on the footway's side is nearest (the outline of the deck there); a side picked by any sample carries
 *  the walkway along its whole edge. Sides that already have a sidewalk are left alone. Returns the report or null. */
export function assignBridgeWalkways(dataset, edges, proj, widthAsphalt, sidewalkWidth) {
    const rows = BRIDGE_WALKWAYS[dataset]; if (!rows?.length) return null;
    const raised = edges.filter(e => !e.virtual && !e.tunnel && Math.max(e.ya, e.yb) > .3);
    const report = { basis: 'OSM footway=sidewalk ways on raised decks: the walkway strip beside the carriageway (bridge-walkways.js)', estimates: ['widthM'], footways: [], edges: [] };
    for (const row of rows) {
        const pts = row.nodes.map(([lat, lon]) => { const q = proj(lat, lon); return [q.x ?? q[0], q.z ?? q[1]]; }), picked = new Map();
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < .05) continue;
            const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, n = Math.max(1, Math.ceil(L));
            for (let k = 0; k <= n; k++) {
                const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
                let best = null;
                for (const e of raised) {
                    if (Math.abs(ux * e.dirx + uz * e.dirz) < PARALLEL) continue;
                    const t = ((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len; if (t < 0 || t > 1) continue;
                    const lat = (x - e.a.x) * e.nx + (z - e.a.z) * e.nz, s = lat >= 0 ? 1 : -1, gap = Math.abs(lat) - widthAsphalt(e, s);
                    if (Math.abs(gap) > REACH_M || (best && Math.abs(gap) >= Math.abs(best.gap))) continue;
                    best = { e, s, gap };
                }
                if (best) { const key = best.e.id + ':' + best.s; if (!picked.has(key)) picked.set(key, best); }
            }
        }
        const rec = { id: row.id, widthM: row.widthM, edges: 0 };
        for (const { e, s, gap } of picked.values()) {
            if (sidewalkWidth(e, s) > .3) continue;
            if (s > 0) e.sidewalkRightM = row.widthM; else e.sidewalkLeftM = row.widthM;
            e.deckWalk = e.deckWalk || {}; e.deckWalk[s] = row.widthM; e.deckWalk.footway = row.id;
            rec.edges++; report.edges.push({ edge: e.id, road: e.road, bridge: !!e.bridge, side: s, widthM: row.widthM, footway: row.id, gapM: Math.round(gap * 100) / 100 });
        }
        report.footways.push(rec);
    }
    return report;
}

/** The walkway width on side s of edge e (0 when that side has none). */
export const deckWalkSide = (e, s) => (e.deckWalk && e.deckWalk[s]) || 0;

/** How far outward of its nominal place the deck walkway on side s of e is drawn at fraction t along e (its kerb is mitred
 *  with the next carriageway's where the width steps: e.deckWalkShift, set by world.js). */
export const deckWalkShiftAt = (e, s, t) => { const v = e.deckWalkShift?.[s]; return v ? v[0] + (v[1] - v[0]) * Math.min(1, Math.max(0, t)) : 0; };
