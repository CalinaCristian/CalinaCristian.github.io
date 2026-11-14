// ============================================================================
//  CONTRAFLOW BUS LANES — a one-way way whose source tags map a bus lane against its direction
//  (`busway=opposite_lane`, `busway:left|right=opposite_lane`, or `oneway:bus|psv=no` with a mapped lane:
//  `lanes:bus|psv:backward`, `bus|psv:lanes:backward` designated) carries that lane in the road topology. Its edges
//  run both ways: `lanesF` are the general lanes of the one-way, `lanesB` the bus-only lanes against it
//  (`e.contraflowBus` = their count). nav.js `canTravel` refuses the bus-only direction to every vehicle; buses use
//  `canTravelBus`. The district packs keep only the edge's bus-lane flag, so this reads the source tags kept at runtime
//  (`data.roadSourceGeometry[road].tags`).
// ============================================================================

const count = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
const designated = (v) => (String(v || '').match(/designated/g) || []).length;

/** The contraflow bus lanes of a source way, or null.
 *  { lanes: bus-only lanes against the one-way, general: lanes of the one-way, total: lanes across the carriageway,
 *    withFlow: a bus lane in the one-way's own direction is mapped too }
 *  Lane counts follow OSM: `lanes` counts every lane, the bus lanes included; `lanes:forward` (the one-way's direction)
 *  wins; without it the general lanes are `lanes` minus the bus lanes; without `lanes` the class default (`defaultLanes`)
 *  stays and the bus lanes widen the carriageway. Right-hand traffic: the opposite lane is on the traffic's left (a lane
 *  mapped on its right would run on the left-hand side and is not built). */
export function contraflowBusLanes(tags, defaultLanes = 1) {
    if (!tags) return null;
    const reverse = tags.oneway === '-1';
    if (!reverse && !/^(yes|true|1)$/.test(tags.oneway || '')) return null; // (implied one-ways: roundabouts, motorways — none mapped with one)
    const fwd = reverse ? 'backward' : 'forward', back = reverse ? 'forward' : 'backward';
    const trafficLeft = reverse ? 'right' : 'left', trafficRight = reverse ? 'left' : 'right';
    const opposite = (v) => v === 'opposite_lane';
    const mapped = opposite(tags.busway) || opposite(tags['busway:' + trafficLeft]) || opposite(tags['busway:both']);
    const lanesBack = count(tags['lanes:bus:' + back]) || count(tags['lanes:psv:' + back]) || designated(tags['bus:lanes:' + back]) || designated(tags['psv:lanes:' + back]);
    const busTwoWay = tags['oneway:bus'] === 'no' || tags['oneway:psv'] === 'no';
    if (!mapped && !(busTwoWay && lanesBack)) return null;
    if (opposite(tags['busway:' + trafficRight]) && !mapped) return null;
    const lanes = lanesBack || count(tags['lanes:' + back]) || 1, total = count(tags.lanes);
    const general = count(tags['lanes:' + fwd]) || (total > lanes ? total - lanes : Math.max(1, defaultLanes));
    const withFlow = tags.busway === 'lane' || tags['busway:both'] === 'lane' || tags['busway:' + trafficRight] === 'lane'
        || count(tags['lanes:bus:' + fwd]) > 0 || count(tags['lanes:psv:' + fwd]) > 0 || designated(tags['bus:lanes:' + fwd]) > 0 || designated(tags['psv:lanes:' + fwd]) > 0
        || designated(tags['bus:lanes']) > 0 || designated(tags['psv:lanes']) > 0 || count(tags['lanes:bus']) > lanes || count(tags['lanes:psv']) > lanes;
    return { lanes, general, total: Math.max(total, general + lanes), withFlow };
}

/** Lay the bus lanes on the left of a→b: the divider between the directions sits `lanes` lane widths in from the left kerb
 *  (lane centres: nav.js / traffic-shared.js laneOffset with median 0 and `laneCenterShiftM` = the divider). Called again
 *  wherever a width pass moves a kerb. */
export function layContraflowLanes(e) {
    if (!e.contraflowBus) return;
    e.median = 0;
    e.laneCenterShiftM = -e.wL + e.contraflowBus * e.laneW;
}

/** The road record's edge becomes two-way with bus-only lanes against the one-way; the carriageway keeps its width
 *  (`total` lanes of the source lane width, or the reviewed / mapped width), centred on the source way. */
export function contraflowEdge(e, cf) {
    const reviewed = e.roadWidthSource?.rightM != null && e.roadWidthSource?.leftM != null;
    const W = reviewed ? e.wL + e.wR : cf.total * e.laneW;
    if (reviewed) e.laneW = Math.min(e.laneW, W / cf.total); else { e.wL = W / 2; e.wR = W / 2; }
    e.oneway = false; e.lanesF = cf.general; e.lanesB = cf.lanes; e.lanes = Math.max(cf.general, cf.lanes);
    e.contraflowBus = cf.lanes; e.contraflowTotal = cf.total; e.busLane = cf.withFlow; e.halfW = Math.max(e.wL, e.wR);
    layContraflowLanes(e);
}

/** One-way for every vehicle but a bus (signs, the chapter start, private-car connectivity). */
export const motorOneway = (e) => !!(e.oneway || e.contraflowBus);

// BUS lettering in a lane: 3 × 5 cells per letter, drawn as one rectangle per run of cells in a row
const GLYPHS = { B: ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'], U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'], S: ['XXX', 'X..', 'XXX', '..X', 'XXX'] };
export const BUS_LETTER_LENGTH = 3; // m along the lane (cells 0.6 m: elongated for a driver's view, as painted lettering is)

/** Rectangles [s0, s1, o0, o1] (edge frame: s along a→b, o right of a→b) of the word `text` read by a driver travelling
 *  `dir` (+1 a→b, −1 b→a) whose lane centre is at `o`; the letters start `sNear` (the end nearest the driver). */
export function laneLettering(text, sNear, o, dir, laneW) {
    const ch = BUS_LETTER_LENGTH / 5, cw = Math.min(0.22, (laneW - 0.9) / (3 * text.length + 1.1 * (text.length - 1))), gap = cw * 1.1;
    const W = text.length * 3 * cw + (text.length - 1) * gap, rects = [];
    [...text].forEach((c, k) => {
        const g = GLYPHS[c]; if (!g) return;
        g.forEach((row, r) => {
            const d0 = (4 - r) * ch, d1 = d0 + ch; // distance ahead of the near end (row 0 is the top, farthest away)
            for (let i = 0; i < 3;) {
                if (row[i] !== 'X') { i++; continue; }
                let j = i; while (j < 3 && row[j] === 'X') j++;
                const x0 = -W / 2 + k * (3 * cw + gap) + i * cw, x1 = -W / 2 + k * (3 * cw + gap) + j * cw; // driver's left → right
                const sa = sNear + dir * d0, sb = sNear + dir * d1, oa = o + dir * x0, ob = o + dir * x1;
                rects.push([Math.min(sa, sb), Math.max(sa, sb), Math.min(oa, ob), Math.max(oa, ob)]);
                i = j;
            }
        });
    });
    return rects;
}
