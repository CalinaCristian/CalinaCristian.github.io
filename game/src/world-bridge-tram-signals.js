// ============================================================================
//  BRIDGE PROFILES, TRAM GRADES, SIGNALS — shared bridge profile / descents, deck jobs, tram grades and clearances, junction pads, signal clusters
//  (moved out of world.js' buildWorld, spec 22: the same statements, run as one step of the build)
// ============================================================================
import { compileSharedBridgeProfile } from './shared-bridge-profile.js';
import { compileSourceBridgeDescents } from './source-bridge-descents.js';
import { clamp, distPointSeg } from './util.js';
import { makeVehicle } from './vehicles.js';
import { MeshBuilder } from './geobuild.js';
import { buildTramGrades } from './tram-grade.js';
import { buildTramTunnelGrades } from './tram-tunnel-grade.js';
import { sidewalkWidth } from './sidewalk-source.js';
import { emittedTramClearance } from './tram-clearance.js';
import { buildRailRoadsideClearance } from './rail-roadside.js';
import { BoxGrid, convexHull, shoulderOf } from './world-shared.js';

export function buildBridgeTramSignals(ctx) {
    const {
        asphaltCorners, city, corner, coveredRoadModels, data, edges, nodeArr, nodes,
        profileStats, rng,
    } = ctx;
    const sharedBridgeProfile = compileSharedBridgeProfile(data, { coreEdges: edges,
        lanePolygon: e => asphaltCorners(e, (f, sd) => sd > 0 ? f.wR : f.wL),
        padLanePolygon: (n, incident) => convexHull(incident.flatMap(e => [corner(e,n,1,e.wR,(f,sd)=>sd>0?f.wR:f.wL),corner(e,n,-1,e.wL,(f,sd)=>sd>0?f.wR:f.wL)])),
        padSurfacePolygon:(n,incident)=>convexHull(incident.flatMap(e=>[corner(e,n,1,e.wR+shoulderOf(e),(f,sd)=>(sd>0?f.wR:f.wL)+shoulderOf(f)),corner(e,n,-1,e.wL+shoulderOf(e),(f,sd)=>(sd>0?f.wR:f.wL)+shoulderOf(f))])) });
    if (sharedBridgeProfile.known) {
        for (const e of edges) { const grade=sharedBridgeProfile.roadGrades.get(e.id); if(!grade)continue;e.sourceBridgeGrade=grade;e.a.y=grade.ya;e.b.y=grade.yb; }
        for (const e of edges) {e.ya=e.a.y;e.yb=e.b.y;}
    }
    const sourceBridgeDescents = compileSourceBridgeDescents(data, { coreEdges: edges,
        lanePolygon: e => asphaltCorners(e, (f, sd) => sd > 0 ? f.wR : f.wL),
        structuralPolygon: e => asphaltCorners(e, (f, sd) => (sd > 0 ? f.wR : f.wL) + shoulderOf(f) + sidewalkWidth(f,sd)),
        padLanePolygon: (n, incident) => convexHull(incident.flatMap(e => [corner(e,n,1,e.wR,(f,sd)=>sd>0?f.wR:f.wL),corner(e,n,-1,e.wL,(f,sd)=>sd>0?f.wR:f.wL)])) });
    if(sourceBridgeDescents.known){
        for(const e of edges){const grade=sourceBridgeDescents.roadGrades.get(e.id);if(!grade)continue;e.sourceBridgeGrade=grade;e.a.y=grade.ya;e.b.y=grade.yb;}
        for(const e of edges){e.ya=e.a.y;e.yb=e.b.y;}
    }
    sharedBridgeProfile.report.sourceDescents = sourceBridgeDescents.report;
    const deckAudit = [], deckJobs = []; let deckWorkers = false; // (deck shaping in the build workers: see displace)
    const sharedBridgeMeshAudit={inputTriangles:0,outputTriangles:0,maxLeafControlErrorM:0,depthLimit:0,limitSamples:[],worstControl:null};
    if(profileStats)profileStats.sharedBridge=sharedBridgeProfile.report;
    // (owner, 2026-11-12, Grozavesti (770, -1016) "lane gets tiny": the two Grivitei slip ramps left the 11 m deck level at
    // the fork node, but in plan their carriageways stay on the main deck for another 20-45 m, so the ramp ran up to 1.3 m
    // under the deck it joins and its lane vanished under that deck's edge. Their descent models now hold the crown level
    // to the source vertex where the two carriageways part: crownHoldSourceNode in source-bridge-descent-models.js.)
    const yAlong = (e, x, z) => { if(e.sourceBridgeGrade?.known)return e.sourceBridgeGrade.heightAtWorld(x,z); const t = clamp(((x - e.a.x) * e.dirx + (z - e.a.z) * e.dirz) / e.len, 0, 1); return e.ya + (e.yb - e.ya) * t; };
    coveredRoadModels.validateProfile(edges);
    const tunnelGrades = buildTramTunnelGrades(data, { coreEdges: edges });
    const tramGrades = buildTramGrades(data, { coreEdges: edges, extraGrades: tunnelGrades.grades, extraReport: tunnelGrades.report, sharedProfile: sharedBridgeProfile }), tramDecks = [];
    const tramPropEnvelope = (data.trams || []).length ? emittedTramClearance(makeVehicle, city.id) : null;
    const railRoadside = buildRailRoadsideClearance(tramGrades, tramPropEnvelope), railRoadsideCaps = [];
    const basarabBlue = new MeshBuilder(); // the blue band along the Basarab deck edges, repeated for the night lighting (see below)
    const bridgeJunctionDecks = [], bridgeJunctionAudit = { sourceForks: [], unresolved: [], undersideTriangles: 0, fasciaTriangles: 0 };
    /** height of junction n's pad at (x, z): the profile of the nearest approach there (n.y on flat junctions) */
    const padHeightAt = (n, x, z) => { const descent=sourceBridgeDescents.padHeightAt?.(n,x,z);if(descent!=null)return descent;const shared=sharedBridgeProfile.known&&sharedBridgeProfile.padHeightAt(n,x,z);if(shared!==false&&shared!=null)return shared; let best = null, bd = Infinity; for (const e of n.edges) { if (e.virtual) continue; const d = distPointSeg(x, z, e.a.x, e.a.z, e.b.x, e.b.z).d; if (d < bd) { bd = d; best = e; } } return best ? yAlong(best, x, z) : n.y; };

    // ---- traffic lights: move stop-line signals onto the junction they control, then cluster
    for (const n of nodeArr) {
        if (!n.signal || !n.edges.length) continue;
        if (n.edges.some(e => /motorway/.test(e.type))) continue;
        if (n.edges.length >= 3) { n.hasLight = true; continue; }
        if (n.flags & 8) { n.hasLight = true; continue; } // mapped controlled pedestrian crossing keeps its own controller
        // BFS along the graph up to 32 m for a junction
        let found = null; const seen = new Set([n]); let frontier = [[n, 0]];
        while (frontier.length && !found) {
            const nf = [];
            for (const [m, d] of frontier) for (const e of m.edges) {
                const o = e.a === m ? e.b : e.a; const dd = d + e.len;
                if (seen.has(o) || dd > 32) continue; seen.add(o);
                if (o.edges.length >= 3) { found = o; break; }
                nf.push([o, dd]);
            }
            frontier = nf;
        }
        if (found) { found.hasLight = true; n.crossing = true; n.zebra = true; }
        else n.hasLight = true; // stand-alone pedestrian light
    }
    // cluster nearby light nodes so complex junctions (dual carriageways) share one controller
    const lightNodes = nodeArr.filter(n => n.hasLight);
    const parent = new Map(lightNodes.map(n => [n, n]));
    const find = (n) => { while (parent.get(n) !== n) { parent.set(n, parent.get(parent.get(n))); n = parent.get(n); } return n; };
    {
        const g = new BoxGrid(70);
        for (const n of lightNodes) g.insert(n.x, n.z, n.x, n.z, n);
        // Wide divided junctions can put their stop-line nodes >38 m apart. Coordinate
        // them on the same level; a bridge above a signal is a different controller.
        for (const n of lightNodes) g.each(n.x - 65, n.z - 65, n.x + 65, n.z + 65, (m) => { if (m !== n && Math.abs(m.y - n.y) < 1.5 && Math.hypot(m.x - n.x, m.z - n.z) < 65) parent.set(find(m), find(n)); });
    }
    const clusters = new Map();
    for (const n of lightNodes) { const r = find(n); let c = clusters.get(r); if (!c) clusters.set(r, c = { nodes: [], offset: rng.range(0, 20) }); c.nodes.push(n); }
    for (const c of clusters.values()) {
        for (const n of c.nodes) n.lightCluster = c;
        // Profile/OSM shape nodes between the stop lines are inside the same box.
        // Retain source signal locations; these intermediate nodes gain no lamp.
        for (const n of c.nodes) for (const first of n.edges) {
            let e = first, m = e.a === n ? e.b : e.a, path = [], dist = e.len;
            while (dist < 100 && !m.hasLight && m.edges.length === 2 && path.length < 24) {
                path.push(m); e = m.edges.find(x => x !== e); dist += e.len; m = e.a === m ? e.b : e.a;
            }
            if (m.lightCluster === c) for (const p of path) p.lightCluster = c;
        }
    }
    // the node at Piața Victoriei keeps its historic id (main.js achievement)
    if (city.id === 'bucharest') {
        const pv = city.proj(44.4522, 26.0859);
        let best = null, bd = 60;
        for (const n of nodeArr) if (n.edges.length >= 3) { const d = Math.hypot(n.x - pv.x, n.z - pv.z); if (d < bd) { bd = d; best = n; } }
        if (best) { delete nodes[best.id]; best.id = 'victoriei'; nodes.victoriei = best; }
    }
    return {
        basarabBlue,
        bridgeJunctionAudit,
        bridgeJunctionDecks,
        clusters,
        deckAudit,
        deckJobs,
        padHeightAt,
        railRoadside,
        railRoadsideCaps,
        sharedBridgeMeshAudit,
        sharedBridgeProfile,
        sourceBridgeDescents,
        tramDecks,
        tramGrades,
        tramPropEnvelope,
        yAlong,
        get deckWorkers() { return deckWorkers; }, set deckWorkers(v) { deckWorkers = v; },
    };
}
