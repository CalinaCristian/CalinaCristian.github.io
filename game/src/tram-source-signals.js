// Literal crossing-footway signal associations. Motor/rail routing remains
// separate; this reuses synthetic game phases, never real-world schedules.
const id = value => String(value);
const controlled = tags => tags?.highway === 'traffic_signals' || tags?.crossing === 'traffic_signals' || tags?.['crossing:signals'] === 'yes';
const roadSource = edge => edge.access?.sourceId ?? edge.sourceId;
const PARALLEL = Math.cos(Math.PI / 9); // same conservative axis rule as signals.js
const incoming = (edge, node) => edge.b === node ? edge.railDirections?.includes(1) : edge.a === node && edge.railDirections?.includes(-1);

/** Read-only plan; callers apply associations only before actor admission.
 * Every candidate starts with identical raw IDs on ONE complete crossing way.
 * The existing world controller must contain the exact mapped road approach. */
export function buildTramSourceSignals(data, network, world) {
    const result = { passed: true, associations: [], bindings: [], unresolved: [], uncontrolled: [] };
    const fail = item => { result.passed = false; result.unresolved.push(item); };
    const motorBySource = new Map();
    const motors = world.graph?.nodes instanceof Map ? [...world.graph.nodes.values()] : Object.values(world.graph?.nodes || {});
    for (const node of motors) if (node.sourceId != null) {
        const key = id(node.sourceId), list = motorBySource.get(key) || []; list.push(node); motorBySource.set(key, list);
    }
    const wanted = new Map();
    for (const crossing of data.tramSourceCrossings || []) {
        const refs = new Set((crossing.nodeIds || []).map(id));
        for (const railId of crossing.railNodeIds || []) {
            const node = network.bySourceNode.get(id(railId));
            if (!node?.edges.length) continue; // retained unmodeled source is not a live approach
            if (!controlled(crossing.nodeTags?.[id(railId)])) { result.uncontrolled.push({ crossingSourceId: crossing.sourceId, railSourceNodeId: railId }); continue; }
            let request = wanted.get(node); if (!request) wanted.set(node, request = { candidates: [], errors: [], crossings: [] });
            request.crossings.push(crossing.sourceId);
            if (!refs.has(id(railId)) || crossing.points == null || crossing.missingNodeIds?.length || crossing.points.length !== crossing.nodeIds.length * 2 || !crossing.points.every(Number.isInteger)) {
                request.errors.push('incomplete-or-inconsistent-crossing-source-context'); continue;
            }
            const points = new Map(); let x = 0, z = 0;
            for (let i = 0; i < crossing.nodeIds.length; i++) { x += crossing.points[i * 2]; z += crossing.points[i * 2 + 1]; points.set(id(crossing.nodeIds[i]), { x: x / data.q, z: z / data.q }); }
            const tolerance = Math.SQRT2 / (2 * data.q) + 1e-5, railPoint = points.get(id(railId));
            if (!(data.q > 0) || !Number.isFinite(tolerance) || ![node.x, node.z, railPoint.x, railPoint.z].every(Number.isFinite) || Math.hypot(node.x - railPoint.x, node.z - railPoint.z) > tolerance) {
                request.errors.push('source-crossing-rail-coordinate-mismatch'); continue;
            }
            const rails = node.edges.filter(e => e.rail === true && e.usable === true && incoming(e, node));
            if (!rails.length) { request.errors.push('no-legal-incoming-source-rail-approach'); continue; }
            let matches = 0;
            for (const incidence of crossing.roadIncidences || []) {
                if (!refs.has(id(incidence.nodeId)) || !controlled(crossing.nodeTags?.[id(incidence.nodeId)])) continue;
                const nodes = motorBySource.get(id(incidence.nodeId)) || [];
                if (nodes.length !== 1) { request.errors.push('missing-or-ambiguous-exact-source-road-node'); continue; }
                const motor = nodes[0], light = world.nodeLight?.[motor.id];
                const roadPoint = points.get(id(incidence.nodeId));
                if (![motor.x, motor.z, roadPoint.x, roadPoint.z].every(Number.isFinite) || Math.hypot(motor.x - roadPoint.x, motor.z - roadPoint.z) > tolerance) { request.errors.push('source-crossing-road-coordinate-mismatch'); continue; }
                if (!motor.hasLight || light?.node !== motor || !motor.lightCluster || !Number.isInteger(motor.lightCluster.phaseCount)) {
                    request.errors.push('exact-source-road-controller-unavailable'); continue;
                }
                if (node.motorNode && (node.motorNode.lightCluster || node.motorNode) !== motor.lightCluster) {
                    request.errors.push('literal-motor-node-controller-mismatch'); continue;
                }
                for (const approach of light.approaches || []) {
                    const edge = approach.edge;
                    if (roadSource(edge) !== incidence.sourceId || (edge.sourceId != null && edge.sourceId !== incidence.sourceId) || !(edge.a === motor || edge.b === motor) || (edge.a === motor && edge.oneway) || !motor.edges.includes(edge)) continue;
                    if (!Number.isInteger(approach.phase) || approach.phase < 0 || approach.phase >= motor.lightCluster.phaseCount) continue;
                    // Require EVERY legal incoming rail leg at this exact source
                    // node to share this road axis. No nearest/first-angle guess.
                    if (!rails.every(r => Math.abs(r.dirx * edge.dirx + r.dirz * edge.dirz) > PARALLEL)) continue;
                    request.candidates.push({ node: motor, edge, phase: approach.phase, controller: motor.lightCluster, railEdges: rails,
                        crossingSourceId: crossing.sourceId, roadSourceId: incidence.sourceId, roadSourceNodeId: incidence.nodeId });
                    matches++;
                }
            }
            if (!matches) request.errors.push('no-verified-parallel-controlled-source-road-approach');
        }
    }
    // A controlled live source node cannot silently become green just because
    // the footway context field is absent or a literal link was not retained.
    for (const node of network.nodes || []) if (node.edges.length && controlled(node.tags) && !node.motorNode && !wanted.has(node)) {
        fail({ railSourceNodeId: node.sourceId, reason: 'missing-controlled-source-crossing-context' });
    }
    for (const [node, request] of wanted) {
        const candidates = request.candidates, first = candidates[0];
        const unambiguous = first && candidates.every(c => c.controller === first.controller && c.phase === first.phase);
        if (request.errors.length || !unambiguous) {
            fail({ railSourceNodeId: node.sourceId, crossingSourceIds: request.crossings, reason: request.errors.length ? 'unresolved-controlled-source-crossing' : 'ambiguous-source-road-controller-or-phase', details: [...new Set(request.errors)], candidates: candidates.map(c => ({ motorNodeId: c.node.id, motorEdgeId: c.edge.id, phase: c.phase })) });
            continue;
        }
        const sourceSignal = { ...first, crossingSourceIds: [...new Set(request.crossings)] };
        result.associations.push({ railNode: node, sourceSignal });
        result.bindings.push({ railSourceNodeId: node.sourceId, crossingSourceIds: sourceSignal.crossingSourceIds, roadSourceNodeId: first.roadSourceNodeId, roadSourceId: first.roadSourceId, motorNodeId: first.node.id, motorEdgeId: first.edge.id, phase: first.phase, railEdgeIds: first.railEdges.map(e => e.id), verifiedMotorApproaches: candidates.map(c => ({ roadSourceNodeId: c.roadSourceNodeId, roadSourceId: c.roadSourceId, motorNodeId: c.node.id, motorEdgeId: c.edge.id, phase: c.phase })), timing: 'existing-synthetic-game-controller-not-real-schedule' });
    }
    return result;
}

/** null means no association; a stale/mismatched association fails closed. */
export function tramSourceSignalState(world, node, edge, time, cycle) {
    const s = node.sourceSignal; if (!s) return null;
    if (s.unresolved) return 'red';
    const light = world.nodeLight?.[s.node.id], approach = light?.approaches.find(a => a.edge === s.edge);
    if (!s.railEdges.includes(edge) || !incoming(edge, node) || light?.node !== s.node || s.node.lightCluster !== s.controller || approach?.phase !== s.phase || typeof world.lightState !== 'function') return 'red';
    const state = world.lightState(s.node.id, s.edge, time, cycle);
    return ['green', 'yellow', 'red'].includes(state) ? state : 'red';
}
