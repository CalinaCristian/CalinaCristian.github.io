// Reviewed, finite additions to a district's source road coverage. This only
// selects literal source segments; it never searches for or creates a join.
import { parseTurnLanes, turnTokenAllows } from '../../game/src/turn-lanes.js';
import { resolveRoadWidth } from '../../game/src/road-widths.js';

const fail = (id, reason) => { throw Error(`source return ${id}: ${reason}`); };
const positiveId = n => Number.isSafeInteger(n) && n > 0;
const sourceId = s => typeof s === 'string' && /^w[1-9]\d*$/.test(s);
const requireFinite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const sourceDir = (road, a, b) => road.nodes.some((n, i) => n === a && road.nodes[i + 1] === b) ? 1 :
    !road.oneway && road.nodes.some((n, i) => n === b && road.nodes[i + 1] === a) ? -1 : 0;

// This is a conservative DOMAIN buffer, not a change to the physical road's
// width. Before clipping, the builder can infer at most a 6.5m tram median.
// Source width/placement still take precedence, including asymmetric placement.
function physicalEnvelopeBound(road, policy) {
    const median = road.sharedLane || road.oneway ? 0 : 6.5;
    const width = resolveRoadWidth(road.tags, road.widthReview, {
        lanes: road.lf + road.lb, lanesF: road.lf, lanesB: road.lb,
        oneway: road.oneway, reverse: road.tags.oneway === '-1', medianM: median,
        sharedLane: road.sharedLane, defaultSharedWidth: road.physicalSharedWidth,
        defaultLaneWidth: road.laneW,
    });
    const halfWidth = width ? Math.max(width.leftM ?? width.widthM, width.rightM ?? width.widthM) :
        road.sharedLane ? road.physicalSharedWidth / 2 : road.oneway ? road.lf * road.laneW / 2 :
            median / 2 + Math.max(road.lf, road.lb) * road.laneW;
    if (!Number.isFinite(halfWidth)) throw Error('source return: unresolved physical road envelope');
    const bodyCorner = Math.hypot(Math.max(policy.playerFrontM, policy.playerRearM), policy.playerHalfWidthM);
    return halfWidth + road.sidewalk + policy.maxShoulderM + bodyCorner + policy.maskCellM / Math.SQRT2;
}

function restrictionsFor(legs, relations, id, { review, ways, byId, pos }) {
    const used = new Set(legs.map(l => +l.sourceId.slice(1))), retained = [];
    for (const [rid, relation] of relations) {
        const { tags, members } = relation;
        if (tags.type !== 'restriction') continue;
        const missingFromAtVisitedNode = !members.some(m => m.role === 'from') &&
            members.some(m => m.role === 'via' && m.type === 'node' &&
                legs.some(l => l.from === m.ref || l.to === m.ref));
        if (!missingFromAtVisitedNode && !members.some(m => m.type === 'way' && used.has(m.ref))) continue;
        const record = { sourceId: 'r' + rid, tags: { ...tags }, members: members.map(m => ({ ...m })) };
        retained.push(record);
        const approvals = (review.restrictionCompliance || []).filter(r => r.sourceId === record.sourceId);
        if (approvals.length > 1) fail(id, `duplicate malformed-restriction review r${rid}`);
        const approval = approvals[0];
        if (approval) {
            const sorted = value => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
            if (!['missing-via-universal-known-transition', 'known-from-via-arrival-not-traversed'].includes(approval.basis) ||
                sorted(tags) !== sorted(approval.expectedRecord?.tags) ||
                JSON.stringify(members) !== JSON.stringify(approval.expectedRecord?.members))
                fail(id, `reviewed malformed restriction r${rid} differs from its literal source pin`);
        }
        if (String(tags.except || '').split(';').some(s => ['motorcar', 'motor_vehicle', 'vehicle'].includes(s.trim()))) continue;
        const kind = tags['restriction:motorcar'] ?? tags['restriction:motor_vehicle'] ?? tags.restriction;
        const conditional = Object.keys(tags).some(k => /^(restriction(?::motorcar|:motor_vehicle)?):conditional$/.test(k));
        if (!kind && !conditional) continue; // e.g. a bus-only restriction is not a motorcar restriction
        const from = members.filter(m => m.role === 'from' && m.type === 'way');
        const to = members.filter(m => m.role === 'to' && m.type === 'way');
        const via = members.filter(m => m.role === 'via');
        if (approval?.basis === 'known-from-via-arrival-not-traversed') {
            const anyConditional = Object.keys(tags).some(k => k === 'conditional' || k.startsWith('restriction') && k.endsWith(':conditional'));
            if (kind !== 'only_right_turn' || anyConditional || members.length !== 2 || to.length || from.length !== 1 || via.length !== 1 || via[0].type !== 'node' ||
                !sourceId(approval.fromSourceId) || !positiveId(approval.viaSourceNodeId) || 'w' + from[0].ref !== approval.fromSourceId || via[0].ref !== approval.viaSourceNodeId)
                fail(id, `unsupported reviewed missing-TO restriction r${rid}`);
            if (legs.some(l => l.sourceId === approval.fromSourceId && l.to === approval.viaSourceNodeId))
                fail(id, `known constrained arrival of missing-TO restriction r${rid} is traversed`);
            const rawFrom = ways.get(from[0].ref), road = byId.get(approval.fromSourceId);
            if (!rawFrom || !road?.access?.publicDrive || !road.access.throughAccess || !rawFrom.nodes.includes(approval.viaSourceNodeId) ||
                !rawFrom.nodes.every(n => positiveId(n) && Array.isArray(pos.get(n)) && pos.get(n).length === 2 && pos.get(n).every(Number.isFinite)))
                fail(id, `missing exact source incidence/metrics for reviewed r${rid}`);
            record.reviewValidation = { basis: 'known-from-via-arrival-not-traversed', fromSourceId: approval.fromSourceId,
                viaSourceNodeId: approval.viaSourceNodeId, reviewedConstrainedArrivals: 0,
                sourceOneWayDepartsVia: !!road.oneway && road.nodes[0] === approval.viaSourceNodeId,
                scope: 'these reviewed legs only; raw missing TO remains absent', runtimeStatus: 'unresolved-missing-to' };
            continue;
        }
        if (approval) {
            const anyConditional = Object.keys(tags).some(k => k === 'conditional' || k.startsWith('restriction') && k.endsWith(':conditional'));
            if (kind !== 'only_right_turn' || anyConditional || members.length !== 2 || via.length || from.length !== 1 || to.length !== 1 ||
                !sourceId(approval.fromSourceId) || !sourceId(approval.toSourceId) || !positiveId(approval.sharedSourceNodeId) ||
                'w' + from[0].ref !== approval.fromSourceId || 'w' + to[0].ref !== approval.toSourceId)
                fail(id, `unsupported reviewed missing-via restriction r${rid}`);
            // A known FROM never traversed cannot constrain this finite path.
            // The source record remains malformed for general runtime routing.
            if (!legs.some(l => l.sourceId === approval.fromSourceId)) {
                record.reviewValidation = { basis: 'known-from-not-traversed', fromSourceId: approval.fromSourceId,
                    scope: 'these reviewed legs only; raw missing via remains absent', runtimeStatus: 'unresolved-missing-via' };
                continue;
            }
            const rawFrom = ways.get(from[0].ref), rawTo = ways.get(to[0].ref), fromRoad = byId.get(approval.fromSourceId), toRoad = byId.get(approval.toSourceId);
            if (!rawFrom || !rawTo || !fromRoad?.access?.publicDrive || !fromRoad.access.throughAccess || !toRoad?.access?.publicDrive || !toRoad.access.throughAccess)
                fail(id, `missing public source geometry for reviewed r${rid}`);
            const shared = [...new Set(rawFrom.nodes.filter(n => rawTo.nodes.includes(n)))];
            if (shared.length !== 1 || shared[0] !== approval.sharedSourceNodeId ||
                rawFrom.nodes.filter(n => n === shared[0]).length !== 1 || rawTo.nodes.filter(n => n === shared[0]).length !== 1)
                fail(id, `ambiguous literal shared-node incidence for reviewed r${rid}`);
            if (![...rawFrom.nodes, ...rawTo.nodes].every(n => positiveId(n) && Array.isArray(pos.get(n)) && pos.get(n).length === 2 && pos.get(n).every(Number.isFinite)))
                fail(id, `missing exact source metrics for reviewed r${rid}`);
            const arrivals = [];
            for (let i = 0; i < legs.length; i++) if (legs[i].sourceId === approval.fromSourceId && legs[i].to === shared[0]) {
                const a = legs[i], b = legs[i + 1];
                if (!b || b.from !== shared[0] || b.sourceId !== approval.toSourceId ||
                    !sourceDir(fromRoad, a.from, a.to) || !sourceDir(toRoad, b.from, b.to))
                    fail(id, `reviewed missing-via restriction r${rid} requires its exact known TO`);
                arrivals.push({ from: a.sourceId, sourceNodeId: shared[0], to: b.sourceId, outgoingSourceNodeId: b.to });
            }
            if (!arrivals.length) fail(id, `no complete reviewed arrival for missing-via restriction r${rid}`);
            record.reviewValidation = { basis: 'missing-via-universal-source-incidence', fromSourceId: approval.fromSourceId, toSourceId: approval.toSourceId,
                sharedSourceNodeId: shared[0], inspectedArrivals: arrivals, scope: 'these reviewed legs only; no via member reconstructed', runtimeStatus: 'unresolved-missing-via' };
            continue;
        }
        // An incomplete only-straight relation with a known node/sole exit can
        // still be obeyed for EVERY possible incoming way. Do not reconstruct
        // its missing member or assert a permission: require that exact exit
        // universally at the recorded node, for this finite reviewed path.
        if (kind === 'only_straight_on' && !conditional && members.length === 2 &&
            !members.some(m => m.role === 'from') && to.length === 1 && via.length === 1 &&
            via[0].type === 'node' && positiveId(via[0].ref) && positiveId(to[0].ref)) {
            const exits = legs.filter(l => l.from === via[0].ref);
            if (!exits.length || legs.at(-1).to === via[0].ref ||
                exits.some(l => +l.sourceId.slice(1) !== to[0].ref))
                fail(id, `incomplete motor restriction r${rid} requires its known sole exit`);
            record.reviewValidation = { basis: 'missing-from-universal-known-exit',
                scope: 'these reviewed legs only; raw missing member remains absent',
                via: via[0].ref, requiredExit: 'w' + to[0].ref,
                inspectedExits: exits.map(l => ({ sourceId: l.sourceId, from: l.from, to: l.to })) };
            continue;
        }
        if (from.length !== 1 || to.length !== 1 || via.length !== 1 || via[0].type !== 'node')
            fail(id, `unsupported touching motor restriction r${rid}; no via-way assumption`);
        for (let i = 1; i < legs.length; i++) {
            const a = legs[i - 1], b = legs[i];
            if (a.to !== via[0].ref || +a.sourceId.slice(1) !== from[0].ref) continue;
            if (conditional) fail(id, `conditional motor restriction r${rid} needs reviewed context`);
            if (!/^(no_|only_)/.test(kind)) fail(id, `unsupported motor restriction r${rid}: ${kind}`);
            const sameTo = +b.sourceId.slice(1) === to[0].ref;
            if (kind.startsWith('only_') && !sameTo || kind.startsWith('no_') && sameTo &&
                (kind !== 'no_u_turn' || from[0].ref !== to[0].ref || b.to === a.from)) fail(id, `prohibited motor transition r${rid}`);
        }
    }
    return retained;
}

function turnLanesAt(a, b, road, raw, pos, roads, id) {
    if (a.sourceId === b.sourceId) return;
    const rawDir = raw.nodes[a.sourceIndex] === a.from ? 1 : -1;
    const terminal = raw.nodes[rawDir > 0 ? raw.nodes.length - 1 : 0];
    if (terminal !== a.to) return; // source terminal application, never an internal shape point
    const text = rawDir > 0 ? raw.tags['turn:lanes:forward'] || (road.oneway ? raw.tags['turn:lanes'] : '') :
        raw.tags['turn:lanes:backward'] || (road.oneway ? raw.tags['turn:lanes'] : '');
    if (!text) return;
    const exits = [];
    for (const candidate of roads) {
        if (!candidate.access?.publicDrive || !candidate.access?.throughAccess) continue;
        candidate.nodes.forEach((node, i) => {
            if (node !== a.to) return;
            for (const j of [i + 1, ...(!candidate.oneway ? [i - 1] : [])]) {
                const to = candidate.nodes[j];
                if (to != null && to !== a.from) exits.push({ sourceId: 'w' + candidate.id, to });
            }
        });
    }
    // A mapped turn may be drawn across several vertices before a source-way
    // split/merge. At a sole legal continuation, its local tangent is not a new
    // turn choice. Preserve the tag and literal course rather than inventing a
    // forbidden branch from a 30-degree classifier. The real choice junction
    // still has its source restriction/turn validation.
    if (exits.length === 1 && exits[0].sourceId === b.sourceId && exits[0].to === b.to)
        return { rawTurnLanes: text, decision: 'single-legal-source-continuation', exits };
    const count = a.dir > 0 ? road.lf : road.lb, lanes = parseTurnLanes(text, count);
    if (!lanes || lanes.some(l => !l)) fail(id, `unresolved source turn:lanes on ${a.sourceId}`);
    const p = pos.get(a.from), q = pos.get(a.to), r = pos.get(b.to);
    const ux = q[0] - p[0], uz = q[1] - p[1], vx = r[0] - q[0], vz = r[1] - q[1];
    const angle = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
    if (!lanes.some(tokens => [...tokens].some(token => turnTokenAllows(token, angle))))
        fail(id, `no source lane permits transition ${a.sourceId}→${b.sourceId}`);
    return { rawTurnLanes: text, decision: 'permitted-source-turn-choice', angleRadians: angle, exits };
}

export function compileSourceReturns({ roads, pos, ways, relations = new Map(), review }) {
    if (review == null) return { pieces: [], routeNodes: new Set(), corridors: [], restrictions: [] };
    if (review.schema !== 1 || !Array.isArray(review.corridors) || !review.corridors.length ||
        !Array.isArray(review.evidence) || !review.evidence.length) fail('review', 'missing schema/corridors/evidence');
    const policy = review.envelope;
    if (!policy || !requireFinite(policy.maskCellM, 1, 40) || !requireFinite(policy.playerFrontM, .1, 10) ||
        !requireFinite(policy.playerRearM, .1, 10) || !requireFinite(policy.playerHalfWidthM, .1, 3) ||
        !requireFinite(policy.maxShoulderM, 0, 3)) fail('review', 'invalid explicit domain envelope');
    const byId = new Map(roads.map(r => ['w' + r.id, r]));
    const pieces = [], routeNodes = new Set(), corridors = [], restrictions = new Map(), ids = new Set();
    for (const entry of review.corridors) {
        const { id, radiusM } = entry;
        if (typeof id !== 'string' || !id || ids.has(id)) fail(id, 'missing/duplicate review identity');
        ids.add(id);
        if (!requireFinite(radiusM, 1, 100) || !Array.isArray(entry.legs) || !entry.legs.length || entry.legs.length > 2000)
            fail(id, 'nonfinite/unbounded radius or leg list');
        if (!sourceId(entry.destinationSourceId)) fail(id, 'missing literal destination source identity');
        const destination = ways.get(+entry.destinationSourceId.slice(1));
        if (!destination) fail(id, 'literal destination source way is unavailable');
        if (review.destination?.sourceId === entry.destinationSourceId) {
            for (const [key, value] of Object.entries(review.destination.requiredTags || {}))
                if (destination.tags[key] !== value) fail(id, `destination source ${key} differs from review`);
        }
        const legs = [];
        for (const spec of entry.legs) {
            if (!sourceId(spec.sourceId) || !positiveId(spec.from) || !positiveId(spec.to) || spec.from === spec.to)
                fail(id, 'invalid literal source leg');
            const road = byId.get(spec.sourceId), raw = ways.get(+spec.sourceId.slice(1));
            if (!road || !raw || !road.access?.publicDrive || !road.access?.throughAccess)
                fail(id, `not an available public through road: ${spec.sourceId}`);
            const matches = [];
            raw.nodes.forEach((n, i) => { if (n === spec.from && raw.nodes[i + 1] === spec.to || n === spec.to && raw.nodes[i + 1] === spec.from) matches.push(i); });
            if (matches.length !== 1) fail(id, `not one exact consecutive raw source segment: ${spec.sourceId}/${spec.from}/${spec.to}`);
            const dir = sourceDir(road, spec.from, spec.to);
            if (!dir || (dir > 0 ? road.lf : road.lb) <= 0)
                fail(id, `illegal literal source direction: ${spec.sourceId}/${spec.from}/${spec.to}`);
            const a = pos.get(spec.from), b = pos.get(spec.to);
            if (![a, b].every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) || Math.hypot(a[0] - b[0], a[1] - b[1]) < .01)
                fail(id, 'missing/degenerate exact source coordinates');
            const requiredRadiusM = physicalEnvelopeBound(road, policy);
            if (radiusM < requiredRadiusM) fail(id, `domain radius ${radiusM}m cannot contain road/body/raster envelope ${requiredRadiusM}m`);
            const leg = { ...spec, sourceIndex: matches[0], dir, fromXZ: [...a], toXZ: [...b], requiredRadiusM };
            const prior = legs.at(-1);
            if (prior) {
                if (prior.to !== leg.from) fail(id, 'disconnected source node identities; nearby XY is not a join');
                if (prior.from === leg.to) fail(id, 'immediate source U-turn is not a return corridor');
                const turn = turnLanesAt(prior, leg, byId.get(prior.sourceId), ways.get(+prior.sourceId.slice(1)), pos, roads, id);
                if (turn) leg.incomingTurnLaneValidation = turn;
            }
            legs.push(leg); routeNodes.add(spec.from); routeNodes.add(spec.to);
        }
        for (const r of restrictionsFor(legs, relations, id, { review, ways, byId, pos })) restrictions.set(r.sourceId, r);
        pieces.push({ r: radiusM, pts: [legs[0].fromXZ, ...legs.map(l => l.toXZ)], sourceReturnId: id });
        corridors.push({ id, destinationSourceId: entry.destinationSourceId, radiusM, legs,
            lengthM: legs.reduce((s, l) => s + Math.hypot(l.toXZ[0] - l.fromXZ[0], l.toXZ[1] - l.fromXZ[1]), 0) });
    }
    return { pieces, routeNodes, corridors, restrictions: [...restrictions.values()], envelope: { ...policy }, evidence: [...review.evidence] };
}
