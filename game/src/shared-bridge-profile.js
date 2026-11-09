import { SHARED_BRIDGE_MODELS } from './shared-bridge-models.js';
import { decodeTramPoints } from './tram-path.js';
import { smoothTramRamp } from './tram-grade.js';
import { clipConvex, polygonArea, convexHull, sourcePath, sourceStation, pathStation, sourceFrames, distance, clipAffine } from './bridge-profile-geometry.js';
const EPS = 1e-7;
const no = v => v == null || /^(no|false|0)$/.test(String(v));
const sorted = value => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])])) : Array.isArray(value) ? value.map(sorted) : value;
const same = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const point = n => [n.x, n.z];
function overlapComponents(A, B, pad, lanePolygon) {
    const candidates = [];
    for (const e of A) for (const f of B) { const poly = clipConvex(lanePolygon(e.nativeEdge || e), lanePolygon(f.nativeEdge || f)); if (polygonArea(poly) > 1e-8) candidates.push({ e, f, poly }); }
    const selected = new Set(candidates.flatMap((c, i) => clipConvex(c.poly, pad).length ? [i] : []));
    let changed = true;
    while (changed) { changed = false; for (let i = 0; i < candidates.length; i++) if (!selected.has(i) && [...selected].some(j => clipConvex(candidates[i].poly, candidates[j].poly).length)) { selected.add(i); changed = true; } }
    return [...selected].map(i => candidates[i]);
}
function firstRadiusStation(path, centre, radius) {
    let station = 0;
    for (let i = 1; i < path.points.length; i++) {
        const a = path.points[i - 1], b = path.points[i], len = distance(a, b);
        if (distance(b, centre) >= radius) {
            let lo = 0, hi = 1; for (let j = 0; j < 60; j++) { const t = (lo + hi) / 2, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; if (distance(p, centre) < radius) lo = t; else hi = t; }
            return station + len * (lo + hi) / 2;
        }
        station += len;
    }
    return null;
}
// A fork can carry nonzero longitudinal grade through its original source
// node. Ease only the actual ground/flat boundaries, not every graph vertex.
function asymmetricRamp(length, height, leftEase, rightEase, maxGrade) {
    const peakGrade=height/(length-(leftEase+rightEase)/2);
    if(!(length>0)||height<0||leftEase<0||rightEase<0||leftEase+rightEase>length||peakGrade>maxGrade+1e-10)return null;
    const at=s=>s<=0?0:s>=length?height:leftEase&&s<leftEase?peakGrade*s*s/(2*leftEase):rightEase&&s>length-rightEase?height-peakGrade*(length-s)**2/(2*rightEase):peakGrade*(s-leftEase/2);
    return {at,length,height,peakGrade,easeM:[leftEase,rightEase],breaks:[0,leftEase,length-rightEase,length]};
}
/** Compile an auditable MODEL candidate. Application is separate: caller must
 * validate physical road/rail ordering and emitted vehicle geometry first. */
export function compileSharedBridgeProfile(data, { coreEdges = [], lanePolygon, padLanePolygon, model = SHARED_BRIDGE_MODELS[0] } = {}) {
    const report = { modelId: model.id, estimated: true, active: false, known: false, basis: model.basis, unresolved: [], sourceRoles: {}, oldProfiles: [], feasibility: null };
    const fail = (reason, extra = {}) => { report.unresolved.push({ reason, ...extra }); return { known: false, report }; };
    const lookup = new Map();
    for (const field of ['scenerySourceGeometry', 'roadSourceGeometry']) for (const w of Object.values(data[field] || {})) if (w?.sourceId) {
        const previous = lookup.get(w.sourceId); if (previous && (!same(previous.nodeIds, w.nodeIds) || !same(previous.projected, w.projected) || !same(previous.tags, w.tags))) return fail('duplicate-source-record-disagrees', { sourceId: w.sourceId });
        lookup.set(w.sourceId, w);
    }
    if (!model.mainSources.flat().some(id => lookup.has(id))) return { known: false, report };
    report.active = true;
    if (typeof lanePolygon !== 'function' || typeof padLanePolygon !== 'function') return fail('missing-actual-protected-lane-geometry');
    const coverage = data.roadSourceNodeTagCoverage;
    if (!data.roadSourceNodeTags || !coverage || coverage.missingSourceNodes?.length || !['ele', 'incline', 'level'].every(k => coverage.keys?.includes(k))) return fail('original-road-node-metric-coverage-unknown');
    for (const id of model.contextSources) {
        const w = lookup.get(id), expected = model.sourceSnapshots[id];
        if (!w || !same(w.nodeIds, expected.nodeIds) || !same(w.projected, expected.projected) || !same(w.tags, expected.tags)) return fail('reviewed-original-source-context-changed', { sourceId: id });
        if (w.tags?.ele != null || w.tags?.incline != null) return fail('authoritative-source-way-metric-requires-review', { sourceId: id, tags: w.tags });
        for (const nodeId of w.nodeIds) {
            const tags = data.roadSourceNodeTags[nodeId];
            if (tags && Object.keys(tags).length) return fail('source-node-metric-or-level-requires-review', { sourceId: id, sourceNodeId: nodeId, tags });
        }
    }
    const railWays = new Map((data.tramSourceWays || []).map(w => [w.sourceId, w]));
    for (const id of [model.referenceRail, model.pairedRail]) {
        const w = railWays.get(id), t = w?.tags;
        if (!w || t.railway !== 'tram' || no(t.bridge) || !no(t.tunnel) || Number(t.layer) !== 2 || Number(t.level) !== 1 || Number(t.gauge) !== 1435 || t.ele != null || t.incline != null) return fail('reviewed-shared-source-rail-context-changed', { sourceId: id });
        if (w.nodeIds.some(n => data.tramSourceNodeTags?.[n]?.ele != null || data.tramSourceNodeTags?.[n]?.incline != null)) return fail('authoritative-source-rail-node-metric-requires-review', { sourceId: id });
    }
    const edges = coreEdges.filter(e => !e.virtual).map(e => ({ ...e, nativeEdge: e, sourceId: e.sourceId || e.access?.sourceId || data.roadSourceGeometry?.[e.road]?.sourceId }));
    const bySource = new Map(), byNode = new Map(), incident = new Map();
    for (const e of edges) { if (!bySource.has(e.sourceId)) bySource.set(e.sourceId, []); bySource.get(e.sourceId).push(e); for (const n of [e.a, e.b]) { if (n.sourceId > 0) byNode.set(n.sourceId, n); if (!incident.has(n.id)) incident.set(n.id, []); incident.get(n.id).push(e); } }
    const paths = Object.fromEntries(Object.entries(model.paths).map(([id, def]) => [id, sourcePath(lookup, def)]));
    if (Object.values(paths).some(p => !p)) return fail('reviewed-road-path-source-node-continuity-lost');
    const roleFrames = Object.fromEntries(Object.entries(paths).map(([id, p]) => [id, sourceFrames(p.points, 8)]));
    if (Object.values(roleFrames).some(p => !p)) return fail('reviewed-road-role-section-field-invalid');
    for (const [role, def] of Object.entries(model.paths)) {
        const p = paths[role]; for (const k of ['ground', 'fork', 'start', 'end', 'bridgeStart']) if (def[k] != null && !p.stations.has(def[k])) return fail('reviewed-path-anchor-absent', { role, sourceNodeId: def[k] });
        if (def.ground != null) { const n = byNode.get(def.ground); if (!n || Math.abs(n.y) > EPS) return fail('existing-source-ground-anchor-not-zero', { role, sourceNodeId: def.ground, y: n?.y }); }
    }
    const reference = railWays.get(model.referenceRail), referencePoints = decodeTramPoints(reference.points, data.q || 10), frames = sourceFrames(referencePoints, model.associationHalfWidthM);
    if (!frames) return fail('source-reference-section-field-invalid');
    const forkNodes = model.forkNodes.map(id => byNode.get(id));
    if (forkNodes.some(n => !n)) return fail('original-source-fork-not-present-in-native-geometry');
    const fk = {
        auxiliary: { node: model.paths.auxiliary.fork, branch: ['w128304850'], mains: ['w458458361', 'w1535667121'] },
        branchA: { node: model.paths.branchA.fork, branch: ['w119235186'], mains: ['w1535667121', 'w1535667122'] },
        branchB: { node: model.paths.branchB.fork, branch: ['w84482671'], mains: ['w1535667122', 'w668700432'] },
        loop: { node: model.paths.loop.fork, branch: ['w84483589'], mains: ['w1552024281', 'w1552024282'] },
        exit: { node: model.paths.exit.fork, branch: ['w118284448'], mains: ['w1552024280', 'w1552024281'] },
    }, overlaps = {}, merge = {}, sectionPoints = forkNodes.map(point);
    for (const [role, def] of Object.entries(fk)) {
        const n = byNode.get(def.node), ins = incident.get(n.id), pad = padLanePolygon(n, ins?.map(e => e.nativeEdge));
        if (!ins || ins.length < 3 || !ins.every(e => e.bridge && !e.tunnel) || !def.branch.concat(def.mains).every(id => lookup.get(id)?.nodeIds.includes(def.node))) return fail('literal-bridge-only-fork-context-lost', { role, sourceNodeId: def.node });
        const A = def.branch.flatMap(id => bySource.get(id) || []), B = def.mains.flatMap(id => bySource.get(id) || []);
        if (!A.length || !B.length) return fail('native-source-fork-branch-coverage-missing', { role });
        const cells = overlapComponents(A, B, pad, lanePolygon); overlaps[role] = cells; let reserve = 0;
        for (const cell of cells) for (const p of cell.poly) {
            const s = roleFrames[role].locate(p)?.s ?? pathStation(paths[role], lookup, cell.e, p); if (!Number.isFinite(s)) return fail('native-ribbon-not-on-its-original-source-path', { role, edgeId: cell.e.id });
            reserve = Math.max(reserve, ['loop', 'exit'].includes(role) ? s : paths[role].length - s); sectionPoints.push(p);
        }
        merge[role] = reserve;
    }
    const internalNode = byNode.get(model.paths.trunk.end), innerEdges = incident.get(internalNode?.id), innerPad = internalNode && padLanePolygon(internalNode, innerEdges.map(e => e.nativeEdge));
    if (!internalNode || !innerEdges || !innerPad) return fail('shared-internal-source-junction-missing');
    const A = bySource.get('w119235186') || [], B = bySource.get('w84482671') || [], internal = overlapComponents(A, B, innerPad, lanePolygon);
    const centre = point(internalNode), radius = Math.max(0, ...internal.flatMap(c => c.poly.map(p => distance(p, centre))));
    if (!(radius > 0)) return fail('shared-internal-radial-junction-extent-unresolved');
    const starts = {};
    for (const role of ['branchA', 'branchB']) {
        let start = firstRadiusStation(paths[role], centre, radius); if (!Number.isFinite(start)) return fail('internal-source-radial-section-not-contained', { role });
        for (const c of internal) for (const p of c.poly) { const e = role === 'branchA' ? c.e : c.f, s = roleFrames[role].locate(p)?.s ?? pathStation(paths[role], lookup, e, p); if (!Number.isFinite(s)) return fail('internal-source-radial-projection-unresolved', { role }); start = Math.max(start, s); }
        starts[role] = start;
    }
    const lengths = Object.fromEntries(['branchA', 'branchB'].map(role => [role, paths[role].length - starts[role] - merge[role]])), shortest = Math.min(...Object.values(lengths));
    const H = model.forkHeightM, G = model.maxGrade, L0 = paths.trunk.length;
    const maxEase = Math.min(model.preferredEaseM, L0 / 3, radius / 3, shortest / 3, (L0 + radius + shortest - H / G) / 3), ease = maxEase * .999;
    if (!(ease > 0) || H < 7.13 || H > G * (L0 + Math.min(paths.branchA.length, paths.branchB.length) - model.preferredEaseM) + EPS) return fail('full-source-fork-height-interval-infeasible', { H, maxEase, lengths, merge });
    const oldHeight = (e,p) => e.ya + (e.yb-e.ya)*Math.max(0,Math.min(1,((p[0]-e.a.x)*e.dirx+(p[1]-e.a.z)*e.dirz)/e.len));
    const shortCrossings = [];
    for(const e of [...A,...B])for(const f of edges){
        if(f.bridge||f.tunnel||f.virtual||Math.abs(f.ya)>EPS||Math.abs(f.yb)>EPS)continue;
        if(Math.max(e.a.x,e.b.x)+15<Math.min(f.a.x,f.b.x)||Math.min(e.a.x,e.b.x)-15>Math.max(f.a.x,f.b.x)||Math.max(e.a.z,e.b.z)+15<Math.min(f.a.z,f.b.z)||Math.min(e.a.z,e.b.z)-15>Math.max(f.a.z,f.b.z))continue;
        const poly=clipConvex(lanePolygon(e.nativeEdge),lanePolygon(f.nativeEdge));if(polygonArea(poly)<1e-8)continue;
        for(const p of poly){const existing=oldHeight(e,p)-oldHeight(f,p);if(existing>3)shortCrossings.push({e,f,p,minimumM:Math.min(5.2,existing)});}
    }
    const shape = junctionEaseM => {
        const radialEaseM=model.c1GroundEaseM!=null?Math.min(ease,radius/3):junctionEaseM, internalHeight=G*(L0-junctionEaseM/2),radialRise=G*(radius-radialEaseM/2);
        return {junctionEaseM,internalHeight,radialRise,trunk:asymmetricRamp(L0,internalHeight,junctionEaseM,0,G),radial:asymmetricRamp(radius,radialRise,0,radialEaseM,G),branches:Object.fromEntries(['branchA','branchB'].map(role=>[role,smoothTramRamp(lengths[role],H-internalHeight-radialRise,{maxGrade:G,easeM:ease})]))};
    };
    const shortHeight=(q,role,p)=>q.internalHeight+q.radial.at(distance(p,centre))+q.branches[role].at(roleFrames[role].locate(p).s-starts[role]);
    const feasible = q => q.trunk&&q.radial&&Object.values(q.branches).every(Boolean)&&shortCrossings.every(c=>shortHeight(q,c.e.sourceId==='w119235186'?'branchA':'branchB',c.p)-oldHeight(c.f,c.p)>=c.minimumM-1e-9);
    let lo=0,hi=Math.min(model.preferredEaseM,radius/3,L0/3);
    if(model.c1GroundEaseM==null&&!feasible(shape(0)))return fail('short-source-ramp-crossing-floor-infeasible', {crossings:shortCrossings.map(c=>({upper:c.e.sourceId,lower:c.f.sourceId,point:c.p,minimumM:c.minimumM}))});
    for(let i=0;i<(model.c1GroundEaseM==null?60:0);i++){const mid=(lo+hi)/2;if(feasible(shape(mid)))lo=mid;else hi=mid;}
    const {junctionEaseM,internalHeight,radialRise,trunk,radial,branches}=shape(model.c1GroundEaseM??lo*.999);
    if(!(junctionEaseM>1e-5))return fail('short-source-ramp-c1-easing-infeasible');
    const sourceFlatAnchor = (role, height, predicate, last=false) => {
        const rows=[...paths[role].stations].map(([nodeId,s])=>({nodeId,s,node:byNode.get(nodeId)})).filter(a=>a.node && Math.abs(a.node.y-height)<EPS && predicate(a));
        return last?rows.at(-1):rows[0];
    };
    const loopAnchor = sourceFlatAnchor('loop', 5.2, a => a.s>merge.loop && (incident.get(a.node.id)||[]).some(e=>e.sourceId==='w84483589' && Math.abs(e.ya-5.2)<EPS && Math.abs(e.yb-5.2)<EPS) && smoothTramRamp(a.s-merge.loop,H-5.2,model));
    const exitAnchor = sourceFlatAnchor('exit', model.stationHeightM, a => a.s>merge.exit && (incident.get(a.node.id)||[]).filter(e=>e.sourceId==='w118284448').every(e=>Math.abs(e.ya-model.stationHeightM)<EPS&&Math.abs(e.yb-model.stationHeightM)<EPS) && smoothTramRamp(a.s-merge.exit,model.stationHeightM-H,model));
    const auxiliaryAnchor = sourceFlatAnchor('auxiliary', model.stationHeightM, a => a.s<paths.auxiliary.length-merge.auxiliary && (incident.get(a.node.id)||[]).some(e=>e.sourceId==='w128304850'&&Math.abs(e.ya-model.stationHeightM)<EPS&&Math.abs(e.yb-model.stationHeightM)<EPS) && smoothTramRamp(paths.auxiliary.length-merge.auxiliary-a.s,model.stationHeightM-H,model),true);
    if(!loopAnchor||!exitAnchor||!auxiliaryAnchor)return fail('existing-intermediate-flat-source-anchors-infeasible');
    const loop = smoothTramRamp(loopAnchor.s-merge.loop,H-5.2,model), exitRamp=smoothTramRamp(exitAnchor.s-merge.exit,model.stationHeightM-H,model), auxiliaryRamp=smoothTramRamp(paths.auxiliary.length-merge.auxiliary-auxiliaryAnchor.s,model.stationHeightM-H,model);
    if(!trunk||!radial||Object.values(branches).some(v=>!v)||!loop||!exitRamp||!auxiliaryRamp)return fail('source-connected-c1-ramp-fit-infeasible');
    const sections = sectionPoints.map(p => frames.locate(p)); if (sections.some(s => !s)) return fail('reviewed-main-road-rail-section-association-ambiguous');
    let zoneLo = Math.min(...sections.map(s => s.s)), zoneHi = Math.max(...sections.map(s => s.s));
    // Choose actual source rail nodes at verified flat11m main-road sections;
    // retain existing geometry/grade outside those homologous sections.
    const normalHits = (p, normal, sourceIds) => {
        const hits = [];
        for (const id of sourceIds) for (const e of bySource.get(id) || []) {
            const v = [e.b.x - e.a.x, e.b.z - e.a.z], den = cross2(normal, v); if (Math.abs(den) < EPS) continue;
            const r = [e.a.x - p[0], e.a.z - p[1]], t = cross2(r, v) / den, u = cross2(r, normal) / den;
            if (u < -EPS || u > 1 + EPS || Math.abs(t) > model.associationHalfWidthM) continue;
            if (!hits.some(h => Math.abs(h.t - t) < 1e-5)) hits.push({ t, e, u, y: e.ya + (e.yb - e.ya) * Math.max(0, Math.min(1, u)) });
        }
        return hits;
    };
    function cross2(a, b) { return a[0] * b[1] - a[1] * b[0]; }
    const stationEvidence=[];
    for(let k=0;k<model.stationNodes.length;k++){
        const way=railWays.get(k?model.pairedRail:model.referenceRail), nodeId=model.stationNodes[k], i=way.nodeIds.indexOf(nodeId), tags=data.tramSourceNodeTags?.[nodeId], xy=decodeTramPoints(way.points,data.q||10), f=sourceFrames(xy,model.associationHalfWidthM);
        if(i<=0||i>=xy.length-1||tags?.public_transport!=='stop_position'||tags?.railway!=='tram_stop')return fail('actual-common-cable-station-source-node-unconfirmed',{nodeId});
        const hits=model.stationRoadSources.map(id=>normalHits(xy[i],f.normals[i],[id]));
        if(hits.some(h=>h.length!==1)||hits[0][0].t*hits[1][0].t>=0||hits.flat().some(h=>Math.abs(h.y-model.stationHeightM)>EPS))return fail('existing-common-cable-station-road-model-unconfirmed',{nodeId});
        stationEvidence.push({nodeId,point:xy[i],hits:hits.flat().map(h=>({sourceId:h.e.sourceId,edgeId:h.e.id,modelY:h.y}))});
    }
    const anchors = [];
    for (let i = 0; i < referencePoints.length; i++) {
        const s = frames.cumulative[i]; if (!(s <= zoneLo - model.transitionM || s >= zoneHi + model.transitionM)) continue;
        const hits = model.mainSources.map(ids => normalHits(referencePoints[i], frames.normals[i], ids));
        if (hits.some(h => h.length !== 1) || hits[0][0].t * hits[1][0].t >= 0) continue;
        if (hits.flat().some(h => Math.abs(h.e.ya - model.stationHeightM) > EPS || Math.abs(h.e.yb - model.stationHeightM) > EPS)) continue;
        anchors.push({ s, nodeId: reference.nodeIds[i], point: referencePoints[i], sourceRoads: hits.flat().map(h => h.e.sourceId), edgeIds: hits.flat().map(h => h.e.id) });
    }
    const south = anchors.filter(a => a.s <= zoneLo - model.transitionM).sort((a, b) => b.s - a.s)[0], north = anchors.filter(a => a.s >= zoneHi + model.transitionM).sort((a, b) => a.s - b.s)[0];
    if (!south || !north) return fail('homologous-existing-flat11m-source-anchors-unresolved', { zoneLo, zoneHi });
    const dipSouth = smoothTramRamp(zoneLo - south.s, model.stationHeightM - H, model), dipNorth = smoothTramRamp(north.s - zoneHi, model.stationHeightM - H, model);
    if (!dipSouth || !dipNorth) return fail('shared-main-c1-transition-infeasible');
    const commonAt = s => s < south.s || s > north.s ? null : s < zoneLo ? model.stationHeightM - dipSouth.at(s - south.s) : s <= zoneHi ? H : H + dipNorth.at(s - zoneHi);
    const commonPoint = p => { const q = frames.locate(p); return q ? commonAt(q.s) : null; };
    const roleSources = new Map(); for (const [role, def] of Object.entries(model.paths)) for (const [id] of def.ways) roleSources.set(id, role);
    const mainSources = new Set(model.mainSources.flat()), roadGrades = new Map();
    for (const e of edges) {
        const role = roleSources.get(e.sourceId), main = mainSources.has(e.sourceId); if (!role && !main) continue;
        const oldYa = e.ya, oldYb = e.yb, legacy = p => { const t = Math.max(0, Math.min(1, ((p[0] - e.a.x) * e.dirx + (p[1] - e.a.z) * e.dirz) / e.len)); return oldYa + (oldYb - oldYa) * t; };
        let s0, s1;
        if (role) { s0 = pathStation(paths[role], lookup, e, point(e.a)); s1 = pathStation(paths[role], lookup, e, point(e.b)); if (![s0, s1].every(Number.isFinite)) return fail('native-model-edge-not-on-original-source-role', { sourceId: e.sourceId, edgeId: e.id }); }
        const atWorld = p => {
            if (main) return commonPoint(p) ?? legacy(p);
            const t = Math.max(0, Math.min(1, ((p[0] - e.a.x) * e.dirx + (p[1] - e.a.z) * e.dirz) / e.len)), s = roleFrames[role].locate(p)?.s ?? s0 + (s1 - s0) * t;
            if (role === 'trunk') return trunk.at(s);
            if (role === 'branchA' || role === 'branchB') return internalHeight + radial.at(distance(p, centre)) + branches[role].at(s - starts[role]);
            if (role === 'loop') return s <= loopAnchor.s ? H - loop.at(s - merge.loop) : legacy(p);
            if (role === 'exit') return s <= exitAnchor.s ? H + exitRamp.at(s - merge.exit) : legacy(p);
            return s >= auxiliaryAnchor.s ? model.stationHeightM - auxiliaryRamp.at(s - auxiliaryAnchor.s) : legacy(p);
        };
        const changed = [0, .25, .5, .75, 1].some(t => { const p = [e.a.x + (e.b.x - e.a.x) * t, e.a.z + (e.b.z - e.a.z) * t]; return Math.abs(atWorld(p) - legacy(p)) > 1e-8; });
        if (!changed) continue;
        const grade = { known: true, modelId: model.id, estimated: true, basis: model.basis, sourceId: e.sourceId, role: main ? 'main' : role,
            ya: atWorld(point(e.a)), yb: atWorld(point(e.b)), heightAt: t => atWorld([e.a.x + (e.b.x - e.a.x) * Math.max(0, Math.min(1, t)), e.a.z + (e.b.z - e.a.z) * Math.max(0, Math.min(1, t))]), heightAtWorld: (x, z) => atWorld([x, z]), oldYa, oldYb };
        roadGrades.set(e.id, grade); report.oldProfiles.push({ edgeId: e.id, sourceId: e.sourceId, ya: oldYa, yb: oldYb });
    }
    const seamValues = new Map();
    for (const e of edges) for (const [key, t] of [['a', 0], ['b', 1]]) { const n = e[key], y = roadGrades.get(e.id)?.heightAt(t) ?? n.y; if (!seamValues.has(n.id)) seamValues.set(n.id, []); seamValues.get(n.id).push(y); }
    for (const [nodeId, values] of seamValues) if (Math.max(...values) - Math.min(...values) > 1e-5) return fail('shared-original-source-node-height-seam', { nodeId, values });
    for (const cells of [...Object.values(overlaps), internal]) for (const cell of cells) for (const p of cell.poly) { const a = roadGrades.get(cell.e.id)?.heightAtWorld(...p) ?? cell.e.ya + (cell.e.yb - cell.e.ya) * Math.max(0, Math.min(1, ((p[0] - cell.e.a.x) * cell.e.dirx + (p[1] - cell.e.a.z) * cell.e.dirz) / cell.e.len)); const b = roadGrades.get(cell.f.id)?.heightAtWorld(...p) ?? cell.f.ya + (cell.f.yb - cell.f.ya) * Math.max(0, Math.min(1, ((p[0] - cell.f.a.x) * cell.f.dirx + (p[1] - cell.f.a.z) * cell.f.dirz) / cell.f.len)); if (Math.abs(a - b) > 1e-5) return fail('shared-protected-lane-overlap-field-disagrees', { upperEdge: cell.e.id, lowerEdge: cell.f.id, point: p, values: [a, b] }); }
    report.stationEvidence=stationEvidence; report.known = true; report.sourceRoles = Object.fromEntries(roleSources); report.feasibility = { forkHeightM: H, requestedConservativeHeadroomFloorM: 7.13, maximumSourceGroundGradeHeightM: G * (L0 + Math.min(paths.branchA.length, paths.branchB.length) - model.preferredEaseM), groundTrunkLengthM: L0, internalSourceNode: internalNode.sourceId, internalHeightM: internalHeight, sharedRadialRadiusM: radius, sharedRadialRiseM: radialRise, branchStartsM: starts, branchRemainingM: lengths, flatMergeM: merge, preferredEaseM: model.preferredEaseM, chosenShortRampEaseM: ease, junctionEaseM, legacyCrossingConstraintPolicy:model.c1GroundEaseM!=null?'diagnostic only; actual emitted whole-fleet headroom required, legacy model datums are not survey':'historical optimizer only; not final ride-quality acceptance', shortCrossingConstraints:shortCrossings.map(c=>({upperEdge:c.e.id,upperSource:c.e.sourceId,lowerEdge:c.f.id,lowerSource:c.f.sourceId,point:c.p,minimumM:c.minimumM,modelM:shortHeight({internalHeight,radialRise,radial,branches},c.e.sourceId==='w119235186'?'branchA':'branchB',c.p)-oldHeight(c.f,c.p)})), actualStageEaseM: { trunk: trunk.easeM, radial: radial.easeM, branchA: branches.branchA.easeM, branchB: branches.branchB.easeM, loop: loop.easeM, exit: exitRamp.easeM, auxiliaryBridge: auxiliaryRamp.easeM }, peakGrade: Math.max(trunk.peakGrade, radial.peakGrade, ...Object.values(branches).map(r => r.peakGrade)), zoneM: [zoneLo, zoneHi], south, north, transitionPeakGrades: [dipSouth.peakGrade, dipNorth.peakGrade], exitAnchor: {nodeId: exitAnchor.nodeId, stationM: exitAnchor.s, peakGrade: exitRamp.peakGrade}, loopAnchor:{nodeId:loopAnchor.nodeId,stationM:loopAnchor.s}, auxiliaryAnchor:{nodeId:auxiliaryAnchor.nodeId,stationM:auxiliaryAnchor.s} };
    const profileStations=[south.s,...dipSouth.breaks.map(s=>south.s+s),zoneLo,zoneHi,...dipNorth.breaks.map(s=>zoneHi+s),north.s].sort((a,b)=>a-b);
    const fullHeight=s=>commonAt(s)??model.stationHeightM;
    const surfaceRegions = poly => {
        const regions=[];
        for(const cell of frames.cells){const P=clipConvex(poly,cell.poly);if(polygonArea(P)<1e-10)continue;const C=cell.stationCoefficients,station=p=>C[0]*p[0]+C[1]*p[1]+C[2], lo=Math.min(...P.map(station)),hi=Math.max(...P.map(station)),bounds=[lo,...profileStations.filter(s=>s>lo+1e-8&&s<hi-1e-8),hi];
            for(let i=1;i<bounds.length;i++){const a=bounds[i-1],b=bounds[i];if(b-a<1e-9)continue;const Q=clipAffine(clipAffine(P,C,a),C.map(v=>-v),-b);if(polygonArea(Q)<1e-10)continue;
                const y0=fullHeight(a),ym=fullHeight((a+b)/2),y1=fullHeight(b),d=b-a,A=2*(y0+y1-2*ym)/(d*d),B=(y1-y0)/d-A*d;
                const coefficients=[A,B,y0],at=(x,z)=>{const u=station([x,z])-a;return(A*u+B)*u+y0;}, values=[y0,y1];if(A){const u=-B/(2*A);if(u>0&&u<d)values.push((A*u+B)*u+y0);}
                regions.push({poly:Q,stationCoefficients:C,stationIntervalM:[a,b],heightCoefficients:coefficients,heightAtWorld:at,minHeightM:Math.min(...values),maxHeightM:Math.max(...values)});
            }
        }
        return regions;
    };
    const adaptRailGrade=(way,index,grade)=>{
        if(!grade?.known||![model.referenceRail,model.pairedRail].includes(way.sourceId))return grade;
        const xy=way.xy||decodeTramPoints(way.points,data.q||10),a=xy[index],b=xy[index+1],v=[b[0]-a[0],b[1]-a[1]],ts=frames.breaksForSegment(a,b,profileStations);
        if(!ts.some(t=>commonPoint([a[0]+v[0]*t,a[1]+v[1]*t])!==null)&&!ts.slice(1).some((t,i)=>commonPoint([a[0]+v[0]*(t+ts[i])/2,a[1]+v[1]*(t+ts[i])/2])!==null))return grade;
        const oldAt=grade.heightAt||((t)=>grade.ya+(grade.yb-grade.ya)*Math.max(0,Math.min(1,t))),heightAt=t=>commonPoint([a[0]+v[0]*t,a[1]+v[1]*t])??oldAt(t);
        return {...grade,ya:heightAt(0),yb:heightAt(1),heightAt,heightAtWorld:(x,z)=>commonPoint([x,z])??oldAt(Math.max(0,Math.min(1,((x-a[0])*v[0]+(z-a[1])*v[1])/(v[0]*v[0]+v[1]*v[1])))),surfaceRegions,sourceBridgeModelId:model.id,sourceBridgeBasis:model.basis,breaks:[...new Set([...(grade.breaks||[]),...ts.filter(t=>t>1e-8&&t<1-1e-8)])].sort((a,b)=>a-b)};
    };
    return { known: true, report, model, roadGrades, frames, commonAt, commonPoint, adaptRailGrade, surfaceRegions, overlaps, internalOverlaps: internal, paths, lookup,
        contains: p => { const q = frames.locate(p); return !!q && q.s >= south.s && q.s <= north.s; },
        railOverride: (way, leg) => { if (![model.referenceRail, model.pairedRail].includes(way.sourceId)) return null; const a = point(leg.a), b = point(leg.b), mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (![a, b, mid].some(p => commonPoint(p) !== null)) return null; return { commonPoint, modelId: model.id }; } };
}
