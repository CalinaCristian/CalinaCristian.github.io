// OSM turn:lanes describes lanes, left to right in the direction of travel,
// at the source way's exit. Internal shape vertices do not repeat that rule.
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

/** Pure source lookup; does not mutate graph/data or draw random numbers. */
export function buildTurnLaneRules(data, edges) {
    const rules = new Map(), byRoad = new Map();
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
