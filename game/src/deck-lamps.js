// Street lamps on reviewed road decks. The generic lamp rule (world.js lampSpots) keeps no lamp on a deck: its spot on
// the deck edge touches the carriageway ribbon. OSM maps no street_lamp on these decks, so positions are a rule, not
// data: one lamp in the guard line of each outer deck edge about every STEP metres, the arm over the carriageway.
// The form (single arm) and the fact that both edges are lit come from the panorama named in each record (viewed only).
export const DECK_LAMPS = [
    // (backlog r3-structures-3) panorama 44.479661, 26.100612 h 253: single-arm lamps on both deck edges, OSM w119926495
    { district: 'pipera', name: 'Podul Barbu Văcărescu', stepM: 30, heightM: 8, minDeckM: 2, review: 'panorama 44.479661, 26.100612 h 253 (round 3): single-arm lamps on both deck edges; spacing and height estimated' },
];

/**
 * env: { district, edges, onRibbon(x, z, r, filter), lampNear(x, z, r), deckY(edge, x, z), place({ x, z, y, h, rot }) }
 * returns [{ name, lamps, sides }]
 */
export function emitDeckLamps(env) {
    const out = [];
    for (const rec of DECK_LAMPS) {
        if (rec.district !== env.district) continue;
        const es = env.edges.filter(e => e.bridge && !e.virtual && e.name === rec.name);
        if (!es.length) { out.push({ name: rec.name, lamps: 0, missing: true }); continue; }
        // order the deck's edges into a chain (a → b) and measure along it; the side of a point is the side of its edge
        const left = new Set(es), chain = [];
        let cur = es.find(e => !es.some(f => f !== e && Math.hypot(f.b.x - e.a.x, f.b.z - e.a.z) < 1)) || es[0];
        while (cur) { chain.push(cur); left.delete(cur); let nx = null, nd = 40; for (const f of left) { const d = Math.hypot(f.a.x - cur.b.x, f.a.z - cur.b.z); if (d < nd) { nd = d; nx = f; } } cur = nx; }
        const sides = { '1': [], '-1': [] }, dbg = { low: 0, ribbon: 0, edges: es.length, chain: chain.length };
        let cum = 0, prev = null;
        for (const e of chain) {
            if (prev) cum += Math.hypot(e.a.x - prev.b.x, e.a.z - prev.b.z);
            for (const sd of [1, -1]) {
                const o = (sd > 0 ? e.wR : e.wL) + 0.35;
                for (let s = 0; s <= e.len; s += 2) {
                    const x = e.a.x + e.dirx * s + e.nx * o * sd, z = e.a.z + e.dirz * s + e.nz * o * sd, y = env.deckY(e, x, z);
                    if (y < rec.minDeckM) { dbg.low++; continue; } if (env.onRibbon(x, z, 0.05, rb => !(rb.e && rb.e.name === rec.name) && Math.abs((rb.y ?? 0) - y) < 1.5)) { dbg.ribbon++; continue; } // (on the ramps' fill, or inside a joining carriageway: not the deck edge)
                    sides[String(sd)].push({ u: cum + s, x, z, y, ox: e.nx * sd, oz: e.nz * sd });
                }
            }
            cum += e.len; prev = e;
        }
        let n = 0;
        for (const k of ['1', '-1']) {
            const P = sides[k].sort((p, q) => p.u - q.u); if (P.length < 2) continue;
            for (let u = P[0].u + rec.stepM / 2; u < P.at(-1).u - 3; u += rec.stepM) {
                let best = null; for (const p of P) if (!best || Math.abs(p.u - u) < Math.abs(best.u - u)) best = p;
                if (!best || Math.abs(best.u - u) > 3 || env.lampNear(best.x, best.z, 6)) continue;
                env.place({ x: best.x, z: best.z, y: best.y, h: rec.heightM, rot: Math.atan2(best.oz, -best.ox) }); n++;
            }
        }
        out.push({ name: rec.name, lamps: n, sides: [sides['1'].length, sides['-1'].length], dbg });
    }
    return out;
}
