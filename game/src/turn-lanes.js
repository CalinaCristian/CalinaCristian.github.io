// OSM turn:lanes describes lanes, left to right in the direction of travel,
// at the source way's exit. Internal shape vertices do not repeat that rule.
import { canTravel } from './nav.js';
const laneCount = (e, dir) => dir > 0 ? (e.lanesF ?? e.lanes ?? 1) : e.oneway ? 0 : (e.lanesB ?? e.lanes ?? 1);
const angle = (e, dir, n, nd) => Math.atan2(
    e.dirx * dir * n.dirz * nd - e.dirz * dir * n.dirx * nd,
    e.dirx * dir * n.dirx * nd + e.dirz * dir * n.dirz * nd);
const known = new Set(['left', 'slight_left', 'sharp_left', 'through', 'right', 'slight_right', 'sharp_right', 'reverse']);

/** Missing, empty/none or unsupported lane values retain the native default. */
function parseTurnLanes(text, count) {
    if (typeof text !== 'string' || !text) return null;
    const rows = text.split('|');
    if (rows.length !== count) return null;
    return rows.map(row => {
        const tokens = row.split(';').map(s => s.trim());
        return tokens.length && tokens.every(t => known.has(t)) ? new Set(tokens) : null;
    });
}

function turnTokenAllows(token, a) {
    const abs = Math.abs(a), side = a < 0 ? 'left' : 'right';
    if (token === 'through') return abs <= Math.PI / 6;
    if (token === 'reverse') return abs >= 5 * Math.PI / 6;
    if (abs >= 5 * Math.PI / 6) return false;
    if (token === side) return abs > Math.PI / 6;
    if (token === 'slight_' + side) return abs >= Math.PI / 12 && abs <= Math.PI / 3;
    if (token === 'sharp_' + side) return abs >= 2 * Math.PI / 3;
    return false;
}

/** Pure source lookup; does not mutate graph/data or draw random numbers.
 *  `rules.unserved` counts the mapped lanes whose role has no legal road for it at the way's end node
 *  ({ lanes, through: carried straight on, open: no road straight on either, every turn that exists allowed,
 *  contraflow: of them on a way with a contraflow bus lane }). */
export function buildTurnLaneRules(data, edges) {
    const rules = new Map(), byRoad = new Map();
    rules.unserved = { lanes: 0, through: 0, open: 0, contraflow: 0 };
    for (const e of edges || []) {
        if (e.virtual || e.rail) continue;
        let list = byRoad.get(e.road); if (!list) byRoad.set(e.road, list = []);
        list.push(e);
    }
    const raw = data?.turnLanes || [];
    for (let i = 0; i + 2 < raw.length; i += 3) {
        const road = data.roads?.[raw[i]], list = byRoad.get(raw[i]);
        if (!road || !list) continue;
        const source = data.roadSourceGeometry?.[raw[i]];
        for (const [endId, textIndex, dir] of [[road[road.length - 1], raw[i + 1], 1], [road[10], raw[i + 2], -1]]) {
            if (textIndex < 0) continue;
            for (const e of list) {
                const end = dir > 0 ? e.b : e.a;
                if (end.id !== endId || end.mapEnd) continue;
                if (source?.nodeIds?.length) {
                    const forward = (source.tags?.oneway === '-1' ? -dir : dir) > 0;
                    const sourceEnd = source.nodeIds[forward ? source.nodeIds.length - 1 : 0];
                    if (String(end.sourceId ?? data.roadNodeIds?.[end.id]) !== String(sourceEnd)) continue;
                }
                const lanes = parseTurnLanes(data.strings?.[textIndex], laneCount(e, dir));
                if (lanes) {
                    // A role with no legal road for it at this node leaves its lane without any continuation: the car in it
                    // stops at the line for good (Calea Floreasca w1206961911 on the contraflow way: its `left` lane turns into
                    // Str. Puțul lui Zamfir one node into the next way; Calea Floreasca at Str. Glinka, Rosetti finale: the
                    // `right` lane's turn is the next junction). Such a lane carries straight on to that turn; with no road
                    // straight on either it allows the turns that exist (the native default).
                    const outs = end.edges.filter(f => f !== e && !f.rail && canTravel(f, f.a === end ? 1 : -1));
                    const fits = (tokens) => outs.some(f => [...tokens].some(t => turnTokenAllows(t, angle(e, dir, f, f.a === end ? 1 : -1))));
                    const uturn = canTravel(e, -dir); // (a `reverse` lane turns back on this road itself)
                    for (let k = 0; k < lanes.length; k++) {
                        if (!lanes[k] || fits(lanes[k]) || (uturn && lanes[k].has('reverse'))) continue;
                        const through = fits(['through']);
                        lanes[k] = through ? new Set([...lanes[k], 'through']) : null;
                        rules.unserved.lanes++; rules.unserved[through ? 'through' : 'open']++; if (e.contraflowBus) rules.unserved.contraflow++;
                    }
                    let pair = rules.get(e); if (!pair) rules.set(e, pair = {});
                    pair[dir] = lanes;
                }
            }
        }
    }
    return rules;
}

export function laneTurnAllowed(rules, e, dir, lane, next, nd) {
    if (!next || e.rail || next.rail) return true;
    const tokens = rules?.get(e)?.[dir]?.[lane];
    if (!tokens) return true;
    const a = angle(e, dir, next, nd);
    for (const token of tokens) if (turnTokenAllows(token, a)) return true;
    return false;
}

/** A turn uses its incoming lane across the pad; an actual straight lane drop
 * still merges before the end of a literal short segment. */
export function preservesTurnLane(rules, e, dir, next, nd) {
    if (!next || e.rail || next.rail) return false;
    const node = dir > 0 ? e.b : e.a;
    if (!node?.edges) return false;
    if (node.edges.length < 3 && !node.hasLight) return false;
    const a = angle(e, dir, next, nd), abs = Math.abs(a);
    if (abs > Math.PI / 6 && abs < 5 * Math.PI / 6) return true;
    return abs >= Math.PI / 12 && abs <= Math.PI / 3 &&
        rules?.get(e)?.[dir]?.some(tokens => tokens?.has('slight_' + (a < 0 ? 'left' : 'right')));
}
