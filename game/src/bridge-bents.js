// Bridge bents (MODEL): regular crossheads and columns under elevated decks.
//
// OSM carries no pier positions, so every bent here is an estimate. The planner
// only decides where a support can physically stand: it never moves a deck, a
// lower road, a rail or a building. Bents are dropped (the span stays open)
// wherever no column can reach the ground or the crosshead would foul the
// clearance of something passing below, so long spans over water, rail yards
// and wide junctions are left to their real long-span structure and are not
// given invented supports.
//
// Pure geometry: world.js supplies the decks and the ground queries.

export const BENT_MODEL = Object.freeze({
    spacingM: 30,          // typical viaduct span between bents
    minChainM: 14,         // shorter isolated chains get no bent of their own
    reachM: 26,            // lateral search for sibling decks carried by the same bent
    joinGapM: 6,           // sibling decks further apart than this are separate structures
    levelToleranceM: 1.5,  // sibling decks must share (nearly) one level
    parallelDot: .8,
    beamDepthM: 1.3, beamWidthM: 1.6,
    columnM: 1.4, columnPitchM: 8, columnSearchStepM: .5, maxCantileverM: 9,
    straddleM: 4, maxSpanM: 26, // a portal frame may stand outside the deck edges and span a lower road
    minBeamSoffitM: 2.4,   // below this a wall pier replaces the crosshead frame
    minWallTopM: 1.2,      // below this the thinning deck fascia already meets the ground
    roadClearanceM: 4.7, railClearanceM: 5.2,
    basis: 'MODEL estimate: 30 m bents, 1.6 x 1.3 m crossheads, 1.4 m square columns; not surveyed',
});

const dot = (ax, az, bx, bz) => ax * bx + az * bz;

/** Order elevated deck edges into chains through their mutual straightest continuation. */
export function deckChains(edges) {
    const at = new Map();
    for (const e of edges) for (const n of [e.a, e.b]) { let list = at.get(n); if (!list) at.set(n, list = []); list.push(e); }
    const leaving = (e, n) => n === e.a ? [e.dirx, e.dirz] : [-e.dirx, -e.dirz];
    const best = (e, n) => {
        const [ox, oz] = leaving(e, n); let found = null, value = .9;
        for (const f of at.get(n)) { if (f === e) continue; const [fx, fz] = leaving(f, n), d = -dot(ox, oz, fx, fz); if (d > value) { value = d; found = f; } }
        return found;
    };
    const link = (e, n) => { const f = best(e, n); return f && best(f, n) === e ? f : null; };
    const seen = new Set(), chains = [];
    const walk = (start, startNode) => { // startNode = the node the walk leaves from
        const items = []; let e = start, from = startNode;
        while (e && !seen.has(e)) {
            seen.add(e); const forward = from === e.a; items.push({ e, forward });
            const to = forward ? e.b : e.a; from = to; e = link(e, to);
        }
        return items;
    };
    for (const e of edges) { if (seen.has(e)) continue; if (!link(e, e.a)) chains.push(walk(e, e.a)); else if (!link(e, e.b)) chains.push(walk(e, e.b)); }
    for (const e of edges) if (!seen.has(e)) chains.push(walk(e, e.a)); // closed loops
    return chains.map((items, id) => {
        let s = 0; for (const it of items) { it.s0 = s; s += it.e.len; it.chain = id; }
        return { id, items, length: s, covered: [] };
    });
}

const chainPoint = (chain, s) => {
    let it = chain.items[0]; for (const candidate of chain.items) { if (candidate.s0 > s) break; it = candidate; }
    const { e, forward } = it, along = Math.min(e.len, Math.max(0, s - it.s0)), d = forward ? along : e.len - along, sign = forward ? 1 : -1;
    return { e, forward, x: e.a.x + e.dirx * d, z: e.a.z + e.dirz * d, tx: e.dirx * sign, tz: e.dirz * sign };
};

/**
 * @param {object} o
 * @param {object[]} o.edges elevated bridge edges ({a, b, dirx, dirz, len})
 * @param {(e, side: 1|-1) => number} o.halfWidth deck half width on the edge's own right (+1) / left (-1)
 * @param {(e, x, z) => number} o.topAt deck surface height
 * @param {(e, x, z) => number} o.soffitAt deck underside height
 * @param {(x0, z0, x1, z1, cb) => void} [o.eachEdge] spatial query over `edges` (may repeat / over-report)
 * @param {(x0, z0, x1, z1, cb) => void} [o.eachRailDeck] rail decks {a:[x,z], b:[x,z], halfWidth, topAt(x,z), soffitAt(x,z)}
 * @param {(x, z, radius, belowY) => boolean} o.columnFree can a column stand here (nothing below `belowY` in the way)
 * @param {(x, z, belowY) => ({y:number, rail?:boolean}|null)} o.lowerSurface what passes under this point, below `belowY`
 * @param {(x, z) => boolean} [o.carried] is this deck point carried by a modelled long-span structure (stays, an arch)
 */
export function planBridgeBents({ edges, halfWidth, topAt, soffitAt, eachEdge, eachRailDeck, columnFree, lowerSurface, carried = null, model = BENT_MODEL }) {
    const M = model, chains = deckChains(edges), owner = new Map();
    for (const c of chains) for (const it of c.items) owner.set(it.e, it);
    const all = (x0, z0, x1, z1, cb) => { for (const e of edges) cb(e); };
    const near = eachEdge || all, bents = [], report = { chains: chains.length, stations: 0, bents: 0, walls: 0, coveredBySibling: 0, carriedBySuperstructure: 0, noColumn: 0, lowClearance: 0, tooLow: 0, shortChains: 0 };
    for (const chain of [...chains].sort((a, b) => b.length - a.length || a.id - b.id)) {
        if (chain.length < M.minChainM) { report.shortChains++; continue; }
        const count = Math.max(1, Math.round(chain.length / M.spacingM)), step = chain.length / count;
        const attempt = (s) => {
            const p = chainPoint(chain, s);
            if (carried?.(p.x, p.z)) return 'carriedBySuperstructure'; // stays or an arch carry this stretch
            const nx = -p.tz, nz = p.tx; // n = left of travel… sign is irrelevant, offsets are signed along n
            const top0 = topAt(p.e, p.x, p.z);
            // every deck measures its own two sides explicitly (edges may run either way, with unequal sides)
            const sideOffset = (e, ex, ez, side) => { const w = halfWidth(e, side), ox = e.nx * side, oz = e.nz * side; return dot(ex + ox * w - p.x, ez + oz * w - p.z, nx, nz); };
            const members = [];
            const addEdge = (e, x, z) => { const a = sideOffset(e, x, z, 1), b = sideOffset(e, x, z, -1); members.push({ lo: Math.min(a, b), hi: Math.max(a, b), top: topAt(e, x, z), soffit: soffitAt(e, x, z), e, x, z }); };
            addEdge(p.e, p.x, p.z);
            const R = M.reachM, seenEdge = new Set([p.e]);
            near(p.x - R, p.z - R, p.x + R, p.z + R, f => {
                if (seenEdge.has(f) || !owner.has(f)) return; seenEdge.add(f);
                if (owner.get(f).chain === chain.id) return;
                if (Math.abs(dot(f.dirx, f.dirz, p.tx, p.tz)) < M.parallelDot) return;
                // crossing of the transverse line p + n·o with f's centre line
                const den = dot(f.dirx, f.dirz, p.tx, p.tz); if (Math.abs(den) < 1e-6) return;
                const u = dot(p.x - f.a.x, p.z - f.a.z, p.tx, p.tz) / den; if (u < 0 || u > f.len) return;
                const x = f.a.x + f.dirx * u, z = f.a.z + f.dirz * u, o = dot(x - p.x, z - p.z, nx, nz); if (Math.abs(o) > R) return;
                if (Math.abs(topAt(f, x, z) - top0) > M.levelToleranceM) return;
                addEdge(f, x, z); members[members.length - 1].u = u;
            });
            eachRailDeck?.(p.x - R, p.z - R, p.x + R, p.z + R, d => {
                if (members.some(m => m.rail === d)) return;
                const dx = d.b[0] - d.a[0], dz = d.b[1] - d.a[1], L = Math.hypot(dx, dz); if (L < 1e-6) return;
                const ux = dx / L, uz = dz / L, den = dot(ux, uz, p.tx, p.tz); if (Math.abs(den) < M.parallelDot) return;
                const u = dot(p.x - d.a[0], p.z - d.a[1], p.tx, p.tz) / den; if (u < 0 || u > L) return;
                const x = d.a[0] + ux * u, z = d.a[1] + uz * u, o = dot(x - p.x, z - p.z, nx, nz); if (Math.abs(o) > R) return;
                const top = d.topAt(x, z); if (!Number.isFinite(top) || Math.abs(top - top0) > M.levelToleranceM) return;
                members.push({ lo: o - d.halfWidth, hi: o + d.halfWidth, top, soffit: d.soffitAt(x, z), rail: d, x, z });
            });
            // keep the laterally contiguous group around the reference deck
            members.sort((a, b) => a.lo - b.lo);
            let group = [], reach = -Infinity, hasRef = false;
            for (const m of members) {
                if (group.length && m.lo - reach > M.joinGapM) { if (hasRef) break; group = []; reach = -Infinity; }
                group.push(m); reach = Math.max(reach, m.hi); hasRef = hasRef || m.e === p.e;
            }
            const lo = Math.min(...group.map(m => m.lo)), hi = Math.max(...group.map(m => m.hi));
            const seat = Math.min(...group.map(m => m.soffit));
            const mark = () => { for (const m of group) if (m.e && m.e !== p.e) { const it = owner.get(m.e), c = chains[it.chain]; c.covered.push(it.s0 + (it.forward ? m.u : m.e.len - m.u)); } chain.covered.push(s); };
            if (seat < M.minWallTopM) return 'tooLow';
            const at = o => [p.x + nx * o, p.z + nz * o];
            const wall = seat - M.beamDepthM < M.minBeamSoffitM, soffit = wall ? 0 : seat - M.beamDepthM;
            // what passes below: nothing under a wall pier; a crosshead must clear it
            const clear = (from, to) => {
                for (let o = from + .4; o <= to - .4 + 1e-9; o += 1) {
                    const [x, z] = at(o), under = lowerSurface(x, z, seat - 1.5); if (!under) continue;
                    if (wall || soffit - under.y < (under.rail ? M.railClearanceM : M.roadClearanceM)) return false;
                }
                return true;
            };
            if (!clear(lo, hi)) return 'lowClearance';
            const columns = []; let beamLo = lo, beamHi = hi;
            if (wall) {
                // a wall pier needs its whole footprint on free ground
                let free = true; for (let o = lo + .5; o <= hi - .5 + 1e-9 && free; o += 1) { const [x, z] = at(o); free = columnFree(x, z, M.beamWidthM * .5, seat - 1.5); }
                if (!free) return 'noColumn';
            } else {
                // free column sites under the decks, and up to straddleM outside them (a portal frame over a lower road)
                const free = [], step = M.columnSearchStepM, inside = o => o >= lo + M.columnM * .5 && o <= hi - M.columnM * .5;
                for (let o = lo - M.straddleM; o <= hi + M.straddleM + 1e-9; o += step) { const [x, z] = at(o); if (columnFree(x, z, M.columnM * .5 + .5, seat - 1.5)) free.push(o); }
                // prefer sites under the deck; an outside site costs its distance again
                const nearest = (target, from, to) => { let found = null, cost = Infinity; for (const o of free) { if (o < from || o > to) continue; const c = Math.abs(o - target) + (inside(o) ? 0 : Math.min(Math.abs(o - lo), Math.abs(o - hi)) + 2); if (c < cost) { cost = c; found = o; } } return found; };
                const width0 = hi - lo, bays = Math.max(1, Math.round(width0 / M.columnPitchM)), pitch = width0 / bays;
                let last = nearest(lo + pitch / 2, lo - M.straddleM, lo + M.maxCantileverM);
                while (last !== null) {
                    columns.push({ o: last, x: at(last)[0], z: at(last)[1] });
                    if (last >= hi - Math.min(M.maxCantileverM, pitch / 2 + step)) break;
                    last = nearest(last + pitch, last + Math.min(pitch, 4), last + M.maxSpanM);
                }
                if (!columns.length || hi - columns[columns.length - 1].o > M.maxCantileverM) return 'noColumn';
                beamLo = Math.min(lo, columns[0].o - M.columnM * .5 - .2); beamHi = Math.max(hi, columns[columns.length - 1].o + M.columnM * .5 + .2);
                if ((beamLo < lo && !clear(beamLo, lo + .8)) || (beamHi > hi && !clear(hi - .8, beamHi))) return 'lowClearance';
                if (beamLo < lo || beamHi > hi) report.straddles = (report.straddles || 0) + 1;
            }
            const width = beamHi - beamLo;
            mark();
            const pedestals = group.filter(m => m.soffit - seat > .05).map(m => ({ o: (m.lo + m.hi) / 2, x: at((m.lo + m.hi) / 2)[0], z: at((m.lo + m.hi) / 2)[1], width: Math.max(1, (m.hi - m.lo) * .7), y0: seat, y1: m.soffit }));
            const [cx, cz] = at((beamLo + beamHi) / 2);
            bents.push({ kind: wall ? 'wall' : 'crosshead', x: cx, z: cz, angle: Math.atan2(p.tx, p.tz), tx: p.tx, tz: p.tz, nx, nz, lo: beamLo, hi: beamHi, deckLo: lo, deckHi: hi, width, seat, soffit, columns, pedestals,
                members: group.map(m => ({ lo: m.lo, hi: m.hi, top: m.top, soffit: m.soffit, rail: !!(m.rail || m.e?.railDeck) })), chain: chain.id, s });
            report[wall ? 'walls' : 'bents']++;
            return 'ok';
        };
        for (let i = 0; i < count; i++) {
            const s0 = (i + .5) * step; report.stations++;
            if (chain.covered.some(c => Math.abs(c - s0) < M.spacingM * .5)) { report.coveredBySibling++; continue; }
            // (owner, 2026-11-11, Basarab: "needs more supports properly positioned, it looks like it's floating") a station
            // where no pier can stand (a road or rail line below, too little clearance) used to be skipped, leaving a span of
            // 60 m or more. It now tries the nearest positions along the deck (up to 12 m either way) before giving up.
            let result = null;
            for (const d of [0, 4, -4, 8, -8, 12, -12]) {
                const s = s0 + d; if (s < 2 || s > chain.length - 2 || (d && chain.covered.some(c => Math.abs(c - s) < M.spacingM * .4))) continue;
                const r = attempt(s); if (r === 'ok') { result = r; if (d) report.shifted = (report.shifted || 0) + 1; break; }
                if (r === 'carriedBySuperstructure') { result = r; break; }
                if (!result) result = r;
            }
            if (result && result !== 'ok') report[result]++;
        }
    }
    return { bents, report, chains: chains.map(c => ({ id: c.id, length: c.length, edges: c.items.length })) };
}
