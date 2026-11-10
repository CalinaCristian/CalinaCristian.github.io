import * as THREE from '../vendor/three.module.min.js';
import { makeVehicle, CAR_COLORS } from './vehicles.js';
import * as VEH from './vehicles.js';
import { TRANSIT, TRANSIT_RE, PHRASES } from './data.js';
import {TrafficDialogue} from './situational-dialogue-traffic.js';
import { makeRng, clamp, angleLerp } from './util.js';
import { makeCrowd, dressFor } from './crowd.js';
import { lanesDir, canTravel, edgeSpeed, isMotorway, turnAngle, nodeList, EdgeIndex, roadSideWidth, roadLateral } from './nav.js';
import { assignSignalPhases, signalState } from './signals.js';
import { collideBuildings } from './world.js';
import { SharedLaneGate } from './shared-lanes.js';
import { ambientTrafficAccess } from './road-access.js';
import { admitInitialTraffic, previewInitialTrafficPose, initialTrafficStaticClearance, initialBodyCover } from './initial-traffic-admission.js';
import { buildTramNetwork, canTravelTram, tramContinuations, sampleTramPath, tramSpan, tramPathPolyline, nearestTramSource, projectTramStations } from './tram-path.js';
import { buildTurnLaneRules, laneTurnAllowed, preservesTurnLane } from './turn-lanes.js';
import { buildMotorTurnRestrictions, motorTurnAllowed, motorRestrictionMode } from './motor-turn-restrictions.js';
import {sourceRoadClearance} from './source-road-clearance.js';
import {relocationPeerQuery} from './pedestrian-relocation-peers.js';
import {evaluateInitialParking} from './initial-parking-behavior.js';
import { buildTramSourceSignals, tramSourceSignalState } from './tram-source-signals.js';
import { fitTramBodySupport } from './tram-body-support.js';

// ============================================================================
//  TRAFFIC — vehicles + pedestrians on the road graph.
//  Edge contract (OSM world): lanesF / lanesB / oneway / median / laneW / halfW /
//  maxspeed / type / tram / busLane / bridge / tunnel / roundabout / trafficMul.
//  Falls back gracefully to the hand-made graph (lanes, speed, no median).
// ============================================================================

const TYPE_MUL = {
    motorway: 0.6, trunk: 0.9, primary: 1.6, secondary: 1.2, tertiary: 0.9, unclassified: 0.4, residential: 0.35,
    living_street: 0.08, service: 0.08, motorway_link: 0.3, trunk_link: 0.35, primary_link: 0.4, secondary_link: 0.3, tertiary_link: 0.25,
};
const trafficMulOf = (e) => e.trafficMul ?? TYPE_MUL[e.type] ?? 0.5;
// Source sides are relative to edge a→b, independently of travel direction.
// Keep scalar-only fixture/legacy fallbacks byte-for-byte compatible.
const sidewalkWidthOf = (world, e, side, fallback = 3) => {
    const native = world?.sidewalkWidth?.(e, side);
    if (Number.isFinite(native)) return Math.max(0, native);
    const explicit = side > 0 ? e.sidewalkRightM : e.sidewalkLeftM;
    return Number.isFinite(explicit) ? Math.max(0, explicit) : e.sidewalk ?? fallback;
};
const sourceSideWidth = (world, e, side) => Number.isFinite(world?.sidewalkWidth?.(e, side)) || Number.isFinite(side > 0 ? e.sidewalkRightM : e.sidewalkLeftM);
// ---- traffic volume by local hour (relative to midday = 1). Used when the world has no trafficProfile(hour).
//      Bucharest: TomTom-style peaks 07–10 and 16–19 (×1.6), quiet nights 22–05 (×0.25). Seattle: flatter.
const HOUR_PROFILE = {
    ro: [[0, 0.25], [5, 0.25], [6, 0.7], [7, 1.6], [10, 1.6], [11, 1.0], [15.5, 1.0], [16, 1.6], [19, 1.6], [20, 1.0], [22, 0.25], [24, 0.25]],
    us: [[0, 0.2], [5, 0.2], [6, 0.6], [7, 1.35], [9.5, 1.35], [10.5, 0.85], [15, 0.85], [16, 1.35], [18.5, 1.35], [19.5, 0.8], [22, 0.2], [24, 0.2]],
};
export function hourDensity(table, h) {
    h = ((h % 24) + 24) % 24;
    for (let i = 1; i < table.length; i++) {
        const [h1, v1] = table[i]; if (h > h1) continue;
        const [h0, v0] = table[i - 1]; const k = (h - h0) / Math.max(1e-6, h1 - h0);
        return v0 + (v1 - v0) * k;
    }
    return table[table.length - 1][1];
}
export function bandOf(density) { return density >= 1.3 ? 'rush' : density <= 0.45 ? 'night' : 'normal'; }
/** vehicles at (x,z) on the street level (not on a deck above / in a tunnel below) */
const streetLevel = (v) => Math.abs((v.y ?? 0.24) - 0.24) < 2;
/** width of the median (tram tracks / divider) */
export function medianOf(e) {
    if (e.median != null) return e.median;
    return e.tram ? 4.4 : (e.type === 'highway' ? 1.2 : 0);
}
/** lateral offset (to the right of travel) of lane `lane` (0 = innermost) */
export function laneOffset(edge, lane, dir = 1) { return (edge.sharedLane ? 0 : medianOf(edge) / 2 + (edge.laneW ?? 3.3) * (lane + 0.5)) + dir * (edge.laneCenterShiftM || 0); }
const tramBaseOffset = e => Math.max(1.45, medianOf(e) / 4);
const tramOffset = (e, dir = 1) => e.rail ? 0 : tramBaseOffset(e) + dir * (e.laneCenterShiftM || 0);
const layerOf = (e) => e.modelLayer ?? ((e.bridge ? 1 : 0) + (e.tunnel ? -1 : 0) + (e.layer | 0));
const isJunction = (n) => n.edges.length >= 3 || n.hasLight;
/** a road cut at the district boundary (closure at its map-end node, spec R10.9): never routed into, never spawned on */
const closedEdge = (e) => e.rail ? !e.usable : !!(e.a.mapEnd || e.b.mapEnd || !ambientTrafficAccess(e));
const actorCanTravel = (e, dir, v) => e.rail ? !!v.tram && canTravelTram(e, dir) : canTravel(e, dir);
// long vehicles (buses, trams, trucks ≥ 8.5 m): the body follows the lane path — front and rear axle points on the
// path, the junction pad crossed as the chord entry lane → exit lane — instead of pivoting on its centre (note 4:
// an 18 m bus turning on its centre swept broadside across the junction mouth, and froze like that when stopped)
const LONG_LEN = 8.5;
// (switch for the body placement below; false = placed like a car. Round-5 QA: the Bellevue finale stalls the same with
//  it off and with the round-4 traffic.js — not the cause)
const LONG_BODY = true;
/** pad half-length used to blend lane paths across node n (junction pad, or a few metres at a bend) */
const padOf = (n, e) => Math.min(Math.max(n.radius ?? 0, 3), e.len * 0.45);
const PED_R = 0.3; // pedestrian body radius (vehicles and static obstacles keep this clear)
function pedestrianPen(v, p, x = v.x, z = v.z, heading = v.heading) {
    const fx = -Math.sin(heading), fz = -Math.cos(heading), dx = p.x - x, dz = p.z - z;
    return PED_R - Math.max(Math.abs(dx * fx + dz * fz) - v.length / 2, Math.abs(-dx * fz + dz * fx) - v.width / 2);
}
function pointInPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
        if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
}
/** distance (m) from position s (a→b frame) on edge e to the nearest junction along the road, both ways (capped at `cap`) */
export function junctionDist(e, s, cap = 60) {
    const walk = (edge, node, d) => {
        let cur = edge, n = node, acc = d, guard = 0;
        while (acc < cap && guard++ < 12) {
            if (isJunction(n)) return acc;
            if (n.edges.length < 2) return Infinity; // dead end
            const nx = n.edges.find(x => x !== cur); if (!nx) return Infinity;
            acc += nx.len; n = nx.a === n ? nx.b : nx.a; cur = nx;
        }
        return acc;
    };
    return Math.min(walk(e, e.b, e.len - s), walk(e, e.a, s));
}
/** extents of the player's rectangle projected on an axis (ux,uz) */
function playerExtent(P, ux, uz) {
    const pl = (P.length || 4.4) / 2, pw = (P.width || 1.8) / 2;
    return Math.abs(P.fx * ux + P.fz * uz) * pl + Math.abs(-P.fz * ux + P.fx * uz) * pw;
}
/** SAT penetration depth between a vehicle and the player (>0 = overlapping, <0 = separation) */
export function playerPen(v, P, x = v.x, z = v.z, fx = v.fx, fz = v.fz) {
    const rx = -fz, rz = fx, prx = -P.fz, prz = P.fx;
    const vl = v.length / 2, vw = v.width / 2;
    const co = ((P.front ?? 2.2) - (P.rear ?? 2.2)) / 2; // (the player's body centre sits ahead of the eye: player.js)
    const dx = P.x + P.fx * co - x, dz = P.z + P.fz * co - z;
    let min = Infinity;
    for (const [ux, uz] of [[fx, fz], [rx, rz], [P.fx, P.fz], [prx, prz]]) {
        const ra = Math.abs(fx * ux + fz * uz) * vl + Math.abs(rx * ux + rz * uz) * vw;
        const pen = ra + playerExtent(P, ux, uz) - Math.abs(dx * ux + dz * uz);
        if (pen < min) min = pen;
    }
    return min;
}

/** SAT penetration of two oriented boxes (centre, unit forward, half length, half width); > 0 = overlapping */
function boxPen(ax, az, afx, afz, al, aw, bx, bz, bfx, bfz, bl, bw) {
    let m = Infinity;
    const dx = bx - ax, dz = bz - az;
    for (let k = 0; k < 4; k++) {
        const ux = k === 0 ? afx : k === 1 ? -afz : k === 2 ? bfx : -bfz, uz = k === 0 ? afz : k === 1 ? afx : k === 2 ? bfz : bfx;
        const ra = Math.abs(afx * ux + afz * uz) * al + Math.abs(-afz * ux + afx * uz) * aw;
        const rb = Math.abs(bfx * ux + bfz * uz) * bl + Math.abs(-bfz * ux + bfx * uz) * bw;
        const p = ra + rb - Math.abs(dx * ux + dz * uz); if (p < m) { m = p; if (m <= 0) return m; }
    }
    return m;
}
/** Signed SAT separation of two drawn vehicle bodies: > 0 penetration, < 0 the widest separating gap (no early exit,
 * so a negative value is a real clearance, unlike boxPen's first separating axis). */
function vvClearance(a, b) {
    const afx = -Math.sin(a.heading), afz = -Math.cos(a.heading), bfx = -Math.sin(b.heading), bfz = -Math.cos(b.heading), dx = b.x - a.x, dz = b.z - a.z;
    let m = Infinity;
    for (let k = 0; k < 4; k++) {
        const ux = k === 0 ? afx : k === 1 ? -afz : k === 2 ? bfx : -bfz, uz = k === 0 ? afz : k === 1 ? afx : k === 2 ? bfz : bfx;
        const ra = Math.abs(afx * ux + afz * uz) * a.length / 2 + Math.abs(-afz * ux + afx * uz) * a.width / 2;
        const rb = Math.abs(bfx * ux + bfz * uz) * b.length / 2 + Math.abs(-bfz * ux + bfx * uz) * b.width / 2;
        m = Math.min(m, ra + rb - Math.abs(dx * ux + dz * uz));
    }
    return m;
}
/** Is a's nose pointing into b's body (b ahead of a and across a's own width band)? In a T-bone exactly one car is. */
function noseInto(a, b) {
    const fx = -Math.sin(a.heading), fz = -Math.cos(a.heading), dx = b.x - a.x, dz = b.z - a.z;
    if (dx * fx + dz * fz <= 0) return false;
    const bfx = -Math.sin(b.heading), bfz = -Math.cos(b.heading), rx = -fz, rz = fx; // a's lateral axis
    const extent = Math.abs(bfx * rx + bfz * rz) * b.length / 2 + Math.abs(-bfz * rx + bfx * rz) * b.width / 2;
    return Math.abs(dx * rx + dz * rz) - extent < a.width / 2;
}
/** A knot that has been opened keeps being opened to this real gap, so the struck car's next step is not refused again. */
const KNOT_OPEN_GAP = 0.3, KNOT_HOLD_S = 1.5;
/** A vehicle farther than this from every active camera is not "in view" for recovery: a 4.4 m car at 700 m subtends
 *  what a 1.8 m person does at the pedestrian recovery limit of 300 m (about 6 mrad, under 10 px at 1080p / 72 degrees). */
const RECOVERY_VIEW_FAR_M = 700;
/** Converging noses (a merge corner): one car keeps yielding at this gap until the other has pulled clear. */
const KNOT_YIELD_GAP = 1.2, KNOT_YIELD_S = 4;
/** penetration between two vehicles as drawn (mesh heading) */
const vvPen = (a, b, ax = a.x, az = a.z, ah = a.heading) => boxPen(ax, az, -Math.sin(ah), -Math.cos(ah), a.length / 2, a.width / 2, b.x, b.z, -Math.sin(b.heading), -Math.cos(b.heading), b.length / 2, b.width / 2);
/** penetration between a vehicle (as drawn) and the player */
const vpPen = (v, P) => { const co = ((P.front ?? 2.2) - (P.rear ?? 2.2)) / 2; return boxPen(v.x, v.z, -Math.sin(v.heading), -Math.cos(v.heading), v.length / 2, v.width / 2, P.x + P.fx * co, P.z + P.fz * co, P.fx, P.fz, (P.length || 4.4) / 2, (P.width || 1.8) / 2); };
/** minimum distance between segments p0p1 and q0q1 */
function segDist(p0x, p0z, p1x, p1z, q0x, q0z, q1x, q1z) {
    const d = (ax, az, bx, bz, px, pz) => { const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1e-9; const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / L2)); return Math.hypot(ax + vx * t - px, az + vz * t - pz); };
    const o = (ax, az, bx, bz, cx, cz) => (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
    const d1 = o(p0x, p0z, p1x, p1z, q0x, q0z), d2 = o(p0x, p0z, p1x, p1z, q1x, q1z), d3 = o(q0x, q0z, q1x, q1z, p0x, p0z), d4 = o(q0x, q0z, q1x, q1z, p1x, p1z);
    if (((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0))) return 0;
    return Math.min(d(p0x, p0z, p1x, p1z, q0x, q0z), d(p0x, p0z, p1x, p1z, q1x, q1z), d(q0x, q0z, q1x, q1z, p0x, p0z), d(q0x, q0z, q1x, q1z, p1x, p1z));
}

// ---------- fixed-size spatial hash (no per-frame allocation) ----------
class Grid {
    constructor(cell, bits = 12, fixed = false) { this.fixed=fixed;this.cell = cell; this.mask = (1 << bits) - 1; this.head = new Int32Array(1 << bits); this.next = new Int32Array(64); this.items = null; }
    hash(ix, iz) { return ((ix * 92837111) ^ (iz * 689287499)) & this.mask; }
    build(items) {
        this.items = items; this.head.fill(-1);
        if (this.next.length < items.length) this.next = new Int32Array(items.length * 2);
        const c = this.cell;
        if(this.fixed&&(!this.ix||this.ix.length<items.length)){this.ix=new Int32Array(items.length);this.iz=new Int32Array(items.length);}
        for (let i = 0; i < items.length; i++) {const x=Math.floor(items[i].x/c),z=Math.floor(items[i].z/c);if(this.fixed){this.ix[i]=x;this.iz[i]=z;} const h = this.hash(x,z); this.next[i] = this.head[h]; this.head[h] = i; }
    }
    /** calls fn(item) for items in cells overlapping the square (x±r, z±r); may include a few extras (hash collisions) */
    query(x, z, r, fn) {
        const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
        const it = this.items;
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { for (const o of it) fn(o); return; }
        for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
            for (let i = this.head[this.hash(ix, iz)]; i !== -1; i = this.next[i]) {
                const o = it[i]; const ox = this.fixed?this.ix[i]:Math.floor(o.x / c), oz = this.fixed?this.iz[i]:Math.floor(o.z / c);
                if (ox === ix && oz === iz) fn(o);
            }
        }
    }
}

/**
 * Traffic simulation.
 *  - vehicles follow lanes with a planned look-ahead path, slow for turns, stop at red / stop signs / zebras,
 *    keep gaps (IDM-like), change lanes when blocked, bypass double-parked cars, honk when stuck.
 *  - trams, buses that serve stops, taxis, police with flashing lights.
 *  - pedestrians walking on sidewalks and crossing at junctions.
 */
export class Traffic {
    constructor(world, city, scene, opts = {}) {
        this.world = world; this.city = city; this.scene = scene;
        this.turnLaneRules = buildTurnLaneRules(world.data, world.graph.edges);
        this.motorTurnRestrictions = buildMotorTurnRestrictions(world.data, world.graph.edges);
        this.buc = city.id === 'bucharest';
        this.rng = makeRng(this.buc ? 99 : 7);
        this.vehicles = [];
        this.time = 0;
        this.cycle = city.traffic?.lightCycle ?? 12;
        this.chaos = this.baseChaos = city.traffic?.chaos ?? 0.5;
        this.onBand = opts.onBand || (() => { });
        this.pool = [];           // inactive vehicles (hidden) — the live count follows the hour of day
        this.profile = { density: 1, parked: 1, aggression: 1, band: 'normal', hour: null };
        this.onBubble = opts.onBubble || (() => { });
        this.onSay = opts.onSay || null; // (target, text, sub, cls): free-text bubbles (parking reactions); falls back to game.hud.say
        this.park = null; this.parking = null; // illegal-parking watch (note 8)
        this.onHonk = opts.onHonk || (() => { });
        this._situational=opts.dialogueHost?new TrafficDialogue(this,opts.dialogueHost):null;this._replyTimers=new Set();
        this.player = null;
        this.maxVehicles = opts.maxVehicles || (this.buc ? 210 : 70);
        this.group = new THREE.Group();
        scene.add(this.group);
        this.index = opts.index || new EdgeIndex(world.graph.edges);
        this.grid = new Grid(16);
        this.police = [];
        this._lightPhase = new Map();
        this.boxes = new Map(); // junction box reservations: node → [{v, path, inE, outE, lane, t}]
        this.stats = { updateMs: 0 };
        this._idSeq = 0;
        this.sharedLanes = new SharedLaneGate(world.graph.edges, (VEH.VEHICLE_KINDS || []).map(kind => VEH.vehicleSize(kind, city.id)));
        this.setupTransit();
        this.buildBusStops();
        this.spawnAll();
        // Keep the historic constructor fleet/RNG draws, then assign each tram
        // its real directed rail source before any actor becomes visible.
        this.initialTramBinding = this.bindSourceTrams();
        this.initialMotorTurnAudit = this.auditMotorRouteTurns();
        this.initialAdmission = admitInitialTraffic(this);
        if (!this.initialTramBinding.passed) this.initialAdmission.passed = false;
        if (!this.initialMotorTurnAudit.passed) this.initialAdmission.passed = false;
        this.base = { moving: this.vehicles.filter(v => this.cls(v) === 'moving').length, parked: this.vehicles.filter(v => v.parked).length };
        this.peds = new Pedestrians(this, opts.maxPeds ?? (this.buc ? 250 : 60));
        if (opts.hour != null) this.setHour(opts.hour, true);
    }

    // ------------------------------------------------------------------ traffic by hour
    cls(v) { return v.service ? 'fixed' : v.parked ? 'parked' : (v.tram || v.isPolice) ? 'fixed' : 'moving'; }

    /** Derived physical crossing ownership; motor routing nodes/edges stay intact. */
    isJunction(node) { return isJunction(node) || this.tramMotorCrossings?.has(node) || !!node.motorNode; }
    boxController(node) { const physical = node.motorNode || node.sourceSignal?.node || node; return physical.lightCluster || physical; }

    railBodyInside(body) {
        const inside = this.world.district?.inside;
        if (!inside) return true;
        for (const p of initialBodyCover(body)) {
            if (!inside(p.x, p.z) || !inside(p.x + p.radius, p.z) || !inside(p.x - p.radius, p.z) || !inside(p.x, p.z + p.radius) || !inside(p.x, p.z - p.radius)) return false;
        }
        return true;
    }

    bindSourceTrams() {
        const actors = this.vehicles.filter(v => v.tram), summary = { passed: true, bindings: [], unresolved: [], rngDraws: 0 };
        if (!actors.length) return summary;
        this.tramNetwork = buildTramNetwork(this.world.data, { motorNodes: nodeList(this.world.graph), resolveGrade: this.world.tramGrade });
        const sourceSignals = buildTramSourceSignals(this.world.data, this.tramNetwork, this.world);
        for (const { railNode, sourceSignal } of sourceSignals.associations) { railNode.sourceSignal = sourceSignal; railNode.hasLight = true; }
        for (const issue of sourceSignals.unresolved) {
            const node = this.tramNetwork.bySourceNode.get(String(issue.railSourceNodeId));
            if (node) { node.sourceSignal = { unresolved: true }; node.hasLight = true; }
        }
        const { associations, ...signalReport } = sourceSignals; this.tramSourceSignals = signalReport;
        summary.sourceSignals = signalReport;
        if (!sourceSignals.passed) summary.passed = false;
        this.tramIndex = new EdgeIndex(this.tramNetwork.edges);
        this.tramMotorCrossings = new Set(this.tramNetwork.nodes.filter(n => n.edges.length && n.motorNode).map(n => n.motorNode));
        summary.source = this.tramNetwork.report;
        for (const v of actors) {
            const before = { sourceId: v.edge.access?.sourceId, edgeId: v.edge.id, dir: v.dir, s: v.s, x: v.x, z: v.z, heading: v.heading };
            const nearest = nearestTramSource(this.tramNetwork, v.x, v.z, v.heading), choice = nearest ? { sourceId: nearest.e.sourceId, sourceNodeIds: nearest.e.sourceNodeIds, dir: nearest.dir, distanceM: nearest.distance, grade: nearest.e.grade.basis, directionKnown: nearest.directionKnown } : null;
            if (!nearest || !nearest.directionKnown || !canTravelTram(nearest.e, nearest.dir)) { summary.passed = false; summary.unresolved.push({ id: v.id, before, sourceChoice: choice, reason: 'nearest-source-track-grade-or-direction-unresolved' }); continue; }
            const candidates = projectTramStations(this.tramNetwork, v.x, v.z, v.heading, v.length, { anchorEdge: nearest.e });
            let accepted = null;
            for (const p of candidates) {
                // Rebinding is local to the original actor, never a far-away
                // fleet redistribution to make an admission count look clean.
                if (p.distance > Math.max(v.length, (v.edge.wL || 0) + (v.edge.wR || 0))) break;
                const plan = { ...v, edge: p.e, dir: p.dir, s: p.s, lane: 0, laneCur: 0, latExtraCur: 0, lateralExtra: 0, latBlend: 0, route: [], hist: [] };
                const pose = previewInitialTrafficPose(this, plan, p.s), body = { ...plan, ...pose };
                if (!this.railBodyInside(body)) continue;
                const physical = initialTrafficStaticClearance(this.world, body); if (!physical.valid) continue;
                accepted = { p, plan, pose }; break;
            }
            if (!accepted) { summary.passed = false; summary.unresolved.push({ id: v.id, before, reason: 'no-local-source-legal-static-clear-rail-placement', candidateCount: candidates.length }); continue; }
            const { p, plan } = accepted;
            for (const key of ['edge', 'dir', 's', 'lane', 'laneCur', 'latExtraCur', 'lateralExtra', 'latBlend', 'route', 'hist']) v[key] = plan[key];
            v.layer = layerOf(v.edge); this.placeOnLane(v, true, 0);
            summary.bindings.push({ id: v.id, kind: v.kind, before, sourceChoice: choice, after: { sourceId: v.edge.sourceId, sourceNodeIds: v.edge.sourceNodeIds, edgeId: v.edge.id, dir: v.dir, s: v.s, x: v.x, y: v.y, z: v.z, heading: v.heading }, distanceM: p.distance, sourceGrade: v.edge.grade.basis });
        }
        this.grid.build(this.vehicles);
        return summary;
    }
    /** {density, parked, aggression, band} for a local hour: world.trafficProfile(hour) when present, else the table */
    profileAt(h) {
        let r = null;
        if (typeof this.world.trafficProfile === 'function') { try { r = this.world.trafficProfile(h, {}); } catch { r = null; } }
        let density, parked, aggression, band, label;
        if (typeof r === 'number') density = r;
        else if (r && typeof r === 'object') {
            density = r.density ?? r.volume ?? r.mul ?? r.factor ?? r.multiplier ?? r.traffic;
            parked = r.parked ?? r.doubleParking ?? r.doubleParked ?? r.parking;
            aggression = r.aggression ?? r.aggressiveness ?? r.aggr ?? r.chaos;
            band = r.band; label = r.label;
        }
        if (!Number.isFinite(density)) density = hourDensity(this.buc ? HOUR_PROFILE.ro : HOUR_PROFILE.us, h);
        if (!Number.isFinite(parked)) parked = 0.4 + 0.6 * Math.min(1, density); // double-parking is a daytime habit
        if (!Number.isFinite(aggression)) aggression = clamp(0.75 + 0.35 * density, 0.8, 1.35);
        if (!['rush', 'night', 'normal'].includes(band)) band = bandOf(density);
        return { density, parked, aggression, band, label, hour: h };
    }
    /** set the city's local hour; the live vehicle count is re-balanced smoothly (instant = apply now, e.g. at load) */
    setHour(h, instant = false) {
        if (!Number.isFinite(h)) return;
        const prev = this.profile;
        if (!instant && prev.hour != null && Math.abs(h - prev.hour) < 1 / 120) return;
        const pr = this.profile = this.profileAt(h);
        const peak = this.buc ? 1.6 : 1.35;
        this.updateHot(h);
        this.target = {
            moving: Math.round(this.base.moving * clamp(pr.density / peak, 0.08, 1)) + (this.jamExtra || 0),
            parked: Math.round(this.base.parked * clamp(pr.parked, 0, 1)),
        };
        this.chaos = clamp(this.baseChaos * pr.aggression, 0, 1);
        // a jump of the clock (menu "Time of day", a scenario override) re-balances at once (out of view); the real clock
        // drifts by minutes, which the 0.25 s ticks in update() absorb smoothly
        const jump = prev.hour != null && Math.min(Math.abs(h - prev.hour), 24 - Math.abs(h - prev.hour)) > 1;
        if (instant || jump) this.rebalance(1e9);
        if (prev.band !== pr.band) this.onBand(pr.band, prev.hour == null ? null : prev.band, pr);
    }
    // ------------------------------------------------------------------ congestion hotspots (spec 13, R13.2)
    /**
     * Real standstill hotspots: [{lat, lon, radius, hours:[[h0,h1],…], level 0..1, note}] (cities.js districts) or
     * [{x, z, …}]. At those local hours: extra cars packed into the hotspot, crawl speed, stop-and-go, honk storms.
     */
    setCongestion(list, proj = null) {
        this.hot = [];
        for (const c of list || []) {
            const q = c.x !== undefined ? { x: c.x, z: c.z } : proj ? proj(c.lat, c.lon) : null; if (!q) continue;
            const r = c.radius ?? 150;
            const edges = this.index.near(q.x, q.z, r, []).filter(e => e.len >= 8 && !closedEdge(e) && !e.tramOnly && e.main !== false && !isMotorway(e) && e.type !== 'service' && Math.hypot((e.a.x + e.b.x) / 2 - q.x, (e.a.z + e.b.z) / 2 - q.z) < r);
            let laneM = 0; for (const e of edges) laneM += e.len * (lanesDir(e, 1) + lanesDir(e, -1));
            this.hot.push({ x: q.x, z: q.z, r, hours: c.hours || [], level: clamp(c.level ?? 0.6, 0, 1), note: c.note || '', edges, laneM, L: 0 });
        }
        if (this.profile.hour != null) this.setHour(this.profile.hour, false);
    }
    /** activity 0..1 of an hours list at local hour h (ramps over 40 min on both sides: jams build and dissolve) */
    static hotActivity(hours, h) {
        let a = 0; const ramp = 0.67;
        for (const [h0, h1] of hours) {
            const d = (x) => ((x % 24) + 24) % 24;
            const inside = h0 <= h1 ? h >= h0 && h <= h1 : (h >= h0 || h <= h1);
            if (inside) { a = 1; break; }
            const before = d(h0 - h), after = d(h - h1);
            a = Math.max(a, 1 - Math.min(before, after) / ramp);
        }
        return clamp(a, 0, 1);
    }
    updateHot(h) {
        if (!this.hot?.length) { this.jamExtra = 0; this.jamMax = 0; return; }
        let extra = 0, mx = 0;
        for (const s of this.hot) {
            s.L = this.jamOverride != null ? s.level * this.jamOverride : s.level * Traffic.hotActivity(s.hours, h);
            mx = Math.max(mx, s.L);
            extra += s.L * s.laneM / 9 * 0.55; // ~one car per 9 m of lane, half of it added on top of the normal traffic
        }
        this.jamMax = mx;
        this.jamExtra = Math.round(Math.min(extra, (this.buc ? 140 : 60)));
    }
    /** the player's car is within `d` m behind v in (about) its lane */
    playerBehind(v, d) {
        const P = this.player; if (!P || this.walker?.active) return false;
        const dx = P.x - v.x, dz = P.z - v.z, f = dx * v.fx + dz * v.fz, l = dx * v.rx + dz * v.rz;
        return f < 0 && f > -d && Math.abs(l) < 3.5;
    }
    /** congestion level 0..1 at (x, z) (1 = standstill core of an active hotspot) */
    jamAt(x, z) {
        let j = 0;
        for (const s of this.hot || []) { if (s.L <= 0.01) continue; const d = Math.hypot(x - s.x, z - s.z) / s.r; if (d < 1.25) j = Math.max(j, s.L * clamp((1.25 - d) / 0.5, 0, 1)); }
        return j;
    }
    /** put v on a lane inside an active hotspot (weighted by level), out of the player's way. true on success */
    placeInHot(v, hidden = true) {
        const act = (this.hot || []).filter(s => s.L > 0.05 && s.edges.length); if (!act.length || v.tram || v.parked) return false;
        const original = this.savePose(v);
        let tot = 0; for (const s of act) tot += s.L * s.laneM;
        for (let tries = 0; tries < 30; tries++) {
            let r = this.rng() * tot, hs = act[0]; for (const s of act) { r -= s.L * s.laneM; if (r <= 0) { hs = s; break; } }
            const e = hs.edges[Math.floor(this.rng() * hs.edges.length)];
            if (closedEdge(e)) continue;
            let dir = this.rng() < 0.5 ? 1 : -1; if (!canTravel(e, dir)) dir = -dir; if (!canTravel(e, dir)) continue;
            if (v.bus && (e.len < 30)) continue;
            const lanes = lanesDir(e, dir), sp = v.long ? this.sSpan(e, dir, v.length, true) : [Math.min(3, e.len / 2), Math.max(e.len / 2, e.len - 3)]; if (!sp) continue;
            v.edge = e; v.dir = dir; v.s = this.rng.range(sp[0], sp[1]); v.route.length = 0; v.layer = layerOf(e); v.latBlend = 0; if (v.hist) v.hist.length = 0;
            v.lane = v.laneCur = v.bus ? lanes - 1 : this.rng.int(0, lanes - 1);
            v.speed = 0; v.stuck = 0; v.still = 0; v.touchT = 0; v.blockT = 0; v.ghost = 0; v.bypass = null; v.served = null; v.dwell = 0; v.jamHold = 0;
            v.latExtraCur = v.lateralExtra = 0;
            this.placeOnLane(v, true, 0);
            if ((hidden && this.inView(v)) || !this.spawnClear(v)) continue;
            this.noteRelocated(v);
            return true;
        }
        this.restorePose(v, original); return false;
    }
    get counts() { let moving = 0, parked = 0; for (const v of this.vehicles) { const c = this.cls(v); if (c === 'moving') moving++; else if (c === 'parked') parked++; } return { moving, parked, active: this.vehicles.length, pool: this.pool.length }; }
    /** hide / show up to `budget` vehicles toward the targets (only out of the player's view) */
    rebalance(budget = 3) {
        if (!this.target) return;
        const P = this.player, c = this.counts; let changed = false;
        // a big batch (city load / hour jump): every placement is checked against all live vehicles + the ones placed so far
        const bulk = budget > 20 && !this._bulk; if (bulk) this._bulk = this.vehicles.slice();
        for (const kind of ['moving', 'parked']) {
            let diff = c[kind] - this.target[kind];
            // too many: hide the ones far away / behind the player
            for (let i = this.vehicles.length - 1; i >= 0 && diff > 0 && budget > 0; i--) {
                const v = this.vehicles[i]; if (this.cls(v) !== kind) continue;
                if (P && budget < 1e8) {
                    const dx = v.x - P.x, dz = v.z - P.z, d = Math.hypot(dx, dz);
                    if (d < 90 || (d < 320 && dx * P.fx + dz * P.fz > -0.3 * d)) continue;
                }
                this.vehicles[i] = this.vehicles[this.vehicles.length - 1]; this.vehicles.pop();
                v.inactive = true; v.mesh.visible = false; v.speed = 0; v.leader = null; this.pool.push(v);
                diff--; budget--; changed = true;
            }
            if (changed && this.grid.items) this.grid.build(this.vehicles);
            // too few: bring pooled ones back somewhere out of view
            for (let i = this.pool.length - 1; i >= 0 && diff < 0 && budget > 0; i--) {
                const v = this.pool[i]; if (this.cls(v) !== kind) continue;
                v.inactive = false;
                let ok;
                if (kind === 'moving' && this.jamMax > 0.05 && this.rng() < 0.75 && this.placeInHot(v, budget < 1e8)) ok = true;
                else if (this.large) ok = this.relocate(v, 300, this.bubble, true);
                else ok = this.respawn(v, budget < 1e8);
                if (!ok) { v.inactive = true; continue; }
                this.pool.splice(i, 1); v.mesh.visible = true; this.vehicles.push(v);
                v.mesh.userData.setLights?.(this.nightLights);
                diff++; budget--; changed = true;
            }
        }
        // rush hour in a hotspot needs more cars than the pool holds: build a few extra ones (they return to the pool off-peak)
        if (this.jamMax > 0.05 && budget > 0) {
            let need = this.target.moving - this.counts.moving; const cap = (this.buc ? 140 : 60) - (this._jamBuilt || 0);
            for (let i = 0; i < Math.min(need, cap, budget > 1e8 ? 400 : 2); i++) {
                const initialEdge = this.world.graph.edges.find(e => !closedEdge(e)); if (!initialEdge) break;
                const v = this.spawn({ edge: initialEdge, dir: 1, lane: 0, s: 0, kind: this.carKind() });
                this._jamBuilt = (this._jamBuilt || 0) + 1; changed = true;
                if (!this.placeInHot(v, budget < 1e8)) { this.vehicles.pop(); v.inactive = true; v.mesh.visible = false; this.pool.push(v); }
                else v.mesh.userData.setLights?.(this.nightLights);
            }
        }
        if (bulk) this._bulk = null;
        if (changed) this.grid.build(this.vehicles); // the grid indexes into this.vehicles
    }

    /** kept for compatibility: instance + static */
    laneOffset(edge, lane, dir = 1) { return laneOffset(edge, lane, dir); }
    static laneOffset(edge, lane, dir = 1) { return laneOffset(edge, lane, dir); }

    /** 'green' | 'yellow' | 'red' for vehicles on `edge` approaching `node` */
    lightState(node, edge) {
        const source = tramSourceSignalState(this.world, node, edge, this.time, this.cycle);
        if (source !== null) return source;
        if (!node.hasLight) return 'green';
        if (this.world.lightState) return this.world.lightState(node.id, edge, this.time, this.cycle);
        // The small legacy worlds use the same conservative phase rules.
        let ph = this._lightPhase.get(node);
        if (!ph) {
            ph = new Map(); const aps = node.edges.filter(e => !e.oneway || e.b === node).map(edge => ({ edge, node }));
            ph.phaseCount = assignSignalPhases(aps); for (const ap of aps) ph.set(ap.edge, ap.phase);
            ph.offset = (node.x * 7.31 + node.z * 3.17) % 20; this._lightPhase.set(node, ph);
        }
        return signalState(ph, ph.get(edge), this.time, this.cycle);
    }

    // ------------------------------------------------------------------ transit (R13.3)
    /** transit streets (research: trolley wires, STB bus / tram routes; Seattle: KCM arterials), the vehicle kinds
     *  vehicles.js offers for them (feature-detected), and the country's car fleet mix (vehicles.js FLEET) */
    setupTransit() {
        const did = this.world.district?.id || this.city.activeDistrict || null;
        const T = (did && TRANSIT[did]) || null, RE = (did && TRANSIT_RE[did]) || null;
        const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        const sets = {}; for (const k of ['trolley', 'bus', 'tram']) sets[k] = new Set((T?.[k] || []).map(norm));
        const has = (e, k) => !!e.name && (sets[k].has(norm(e.name)) || !!RE?.[k]?.test(e.name));
        let nT = 0, nB = 0;
        for (const e of this.world.graph.edges) {
            e.trolleyWire = !isMotorway(e) && !e.tramOnly && has(e, 'trolley');
            e.busRoute = !isMotorway(e) && !e.tramOnly && (has(e, 'bus') || e.trolleyWire);
            if (e.trolleyWire) nT++; if (e.busRoute) nB++;
        }
        const K = new Set(VEH.VEHICLE_KINDS || []), pick = (...c) => c.find(k => K.has(k)) || null;
        try { VEH.setFleetCity?.(this.city.id); } catch { /* older vehicles.js */ }
        this.transitKinds = {
            tram: pick('tram-v3a', 'tram-stb', 'stb-tram', 'tram'),
            trolley: this.buc ? pick('trolleybus', 'trolleybus-stb', 'stb-trolleybus') : null,
            bus: this.buc ? pick('stb-bus', 'bus-stb', 'bus') : pick('kcm-bus', 'bus-kcm', 'metro-bus', 'bus'),
        };
        // vehicles.js picks the model within a mode (Imperio vs V3A trams, KCM articulated buses …) when it can
        const ptk = typeof VEH.pickTransitKind === 'function' ? VEH.pickTransitKind : null;
        this.transitKind = (mode) => {
            const base = this.transitKinds[mode === 'trolleybus' ? 'trolley' : mode];
            if (!base) return null;
            if (ptk) { try { const k = ptk(this.city.id, mode, this.rng); if (k && (!K.size || K.has(k))) return k; } catch { /* ignore */ } }
            return base;
        };
        // fleet mix: vehicles.js FLEET[city] / fleetMix(city) → [[kind, weight]], only kinds it can build
        let fleet = null;
        try { fleet = (typeof VEH.fleetMix === 'function' ? VEH.fleetMix(this.city.id) : null) || VEH.FLEET?.[this.city.id] || VEH.FLEET?.[this.buc ? 'RO' : 'US'] || null; } catch { fleet = null; }
        if (fleet && !Array.isArray(fleet)) fleet = Object.entries(fleet);
        fleet = Array.isArray(fleet) ? fleet.map(f => Array.isArray(f) ? f : [f.kind, f.weight ?? f.w ?? 1]).filter(([k, w]) => w > 0 && (!K.size || K.has(k))) : null;
        if (fleet?.length) { const tot = fleet.reduce((a, f) => a + f[1], 0); this.fleet = fleet.map(([k, w]) => [k, w / tot]); } else this.fleet = null;
        this.transit = { district: did, trolleyEdges: nT, busEdges: nB, kinds: this.transitKinds, fleet: !!this.fleet };
    }
    /** a car kind from the fleet mix (vehicles.js FLEET) or the built-in table */
    carKind(e = null) {
        const kinds = this.fleet || (this.buc ? [['hatch', 0.4], ['sedan', 0.22], ['suv', 0.1], ['taxi', 0.12], ['van', 0.1], ['truck', 0.03], ['pickup', 0.03]] : [['suv', 0.36], ['pickup', 0.19], ['sedan', 0.26], ['hatch', 0.06], ['van', 0.07], ['truck', 0.04], ['taxi', 0.02]]);
        let r = this.rng(), k = kinds[kinds.length - 1][0];
        for (const [kk, p] of kinds) { r -= p; if (r <= 0) { k = kk; break; } }
        if (e && isMotorway(e) && /bus|tram/.test(k)) k = this.buc ? 'sedan' : 'suv';
        return k;
    }
    /** the highest lane index a non-bus may use on (e, dir): the outermost lane is a bus lane where the edge has one */
    carLaneMax(e, dir, v = null) { const n = lanesDir(e, dir) || 1; return e.busLane && n > 1 && !isMotorway(e) && !v?.busLaneOk ? n - 2 : n - 1; }

    // ------------------------------------------------------------------ bus stops
    buildBusStops() {
        this.busStops = new Map(); // edge -> [{s (a→b), side}]
        // a bus stops with its front at the stop: the whole body (up to an 18 m articulated bus) must stand in its lane,
        // off the junction pads (note 4) — the stop moves along the kerb to the nearest such spot, or is not served
        const TK = this.transitKinds || {}, Lb = Math.max(12.5, TK.bus ? this.kindLength(TK.bus) : 0, TK.trolley ? this.kindLength(TK.trolley) : 0, this.buc ? 0 : 18.3) + 1;
        const add = (e, s, side) => {
            const dir = e.oneway ? 1 : side, len = e.len, st = dir > 0 ? e.a : e.b, en = dir > 0 ? e.b : e.a;
            const lo = Lb - Math.min(this.runTo(st, e, Lb), Lb), hi = Math.min(len - 0.5, len + this.runTo(en, e, Lb));
            if (hi < lo) return;
            const sAl = clamp(dir > 0 ? s : len - s, lo, hi); s = dir > 0 ? sAl : len - sAl;
            let a = this.busStops.get(e); if (!a) this.busStops.set(e, a = []); a.push({ s, side, id: this.busStops.size + ':' + a.length });
        };
        const stops = (this.world.pois || []).filter(p => p.kind === 'busstop');
        if (stops.length) {
            for (const p of stops) {
                const x = p.x ?? p.doorX, z = p.z ?? p.doorZ;
                const ne = this.index.nearest(x, z, 60); if (!ne || isMotorway(ne.edge)) continue;
                const e = ne.edge; const side = ((x - ne.cx) * e.nx + (z - ne.cz) * e.nz) >= 0 ? 1 : -1;
                add(e, clamp(ne.t * e.len, 3, e.len - 3), e.oneway ? 1 : side);
                p._busEdge = e;
            }
        } else {
            // virtual stops on the bigger urban roads
            const r = makeRng(5);
            for (const e of this.world.graph.edges) {
                if (isMotorway(e) || e.len < 140) continue;
                for (const side of [1, -1]) if (canTravel(e, side) && r.chance(0.6)) add(e, e.len * r.range(0.35, 0.65), side);
            }
        }
    }

    // ------------------------------------------------------------------ spawning
    spawnAll() {
        const { edges } = this.world.graph;
        const density = this.city.traffic?.density ?? 0.7;
        // transit share: buses on bus routes (more on trolley streets: trolleybuses), cars from the fleet mix elsewhere
        const TK = this.transitKinds || {}, anyRoutes = (this.transit?.busEdges || 0) > 0;
        const pickKind = (e) => {
            if (!isMotorway(e) && !e.tramOnly && !closedEdge(e)) {
                const pBus = anyRoutes ? (e.busRoute ? (this.buc ? 0.09 : 0.07) : 0.006) : (this.buc ? 0.05 : 0.03);
                if (this.rng() < pBus) return e.trolleyWire && TK.trolley && this.rng() < 0.6 ? this.transitKind('trolleybus') : (this.transitKind('bus') || 'bus');
            }
            return this.carKind(e);
        };
        const plan = [];
        for (const e of edges) {
            if (e.len < 4 || closedEdge(e)) continue;
            for (const dir of [1, -1]) {
                const lanes = lanesDir(e, dir); if (!lanes) continue;
                const exp = (e.len / 55) * trafficMulOf(e) * density * lanes;
                let n = Math.floor(exp); if (this.rng() < exp - n) n++;
                for (let i = 0; i < n; i++) plan.push({ e, dir });
            }
        }
        for (let i = plan.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [plan[i], plan[j]] = [plan[j], plan[i]]; }
        const occupied = new Map();
        const free = (e, dir, lane, s, len) => {
            if (!this.sharedLanes.canPlace(e, dir, this.vehicles, null, { s, length: len })) return false;
            const k = e.id + ':' + dir + ':' + lane; const arr = occupied.get(k) || [];
            for (const o of arr) if (Math.abs(o - s) < len + 3) return false;
            arr.push(s); occupied.set(k, arr); return true;
        };
        const nPolice = this.buc ? 2 : 2;
        for (const { e, dir } of plan) {
            if (this.vehicles.length >= this.maxVehicles - nPolice) break;
            const kind = pickKind(e);
            const lanes = lanesDir(e, dir), isBus = this.isBusKind(kind), kL = this.kindLength(kind);
            const lane = isBus ? lanes - 1 : this.rng.int(0, this.carLaneMax(e, dir));
            const sp = this.sSpan(e, dir, kL, isBus || kL >= LONG_LEN); if (!sp) continue; // (a bus never straddles a junction mouth)
            const s = e.len < 10 ? e.len / 2 : this.rng.range(sp[0], sp[1]);
            if (!free(e, dir, lane, s, isBus || kL >= LONG_LEN ? kL + 1 : 5)) continue;
            this.spawn({ edge: e, dir, lane, s, kind });
        }
        // police cruisers on bigger roads
        const big = edges.filter(e => !e.tram && !closedEdge(e) && e.len > 30 && trafficMulOf(e) >= 0.9);
        for (let i = 0; i < nPolice && big.length; i++) {
            const e = this.rng.pick(big); const dir = canTravel(e, 1) ? 1 : -1;
            const v = this.spawn({ edge: e, dir, lane: 0, s: this.rng.range(2, e.len - 2), kind: 'police' });
            this.police.push(v);
        }
        // double-parked cars (Bucharest special)
        const pc = this.city.traffic?.parkedChance ?? 0;
        const maxParked = Math.round(this.maxVehicles * 0.2), maxTrams = this.large ? 26 : 200;
        this.initialParking = { attempted: 0, admitted: 0, refused: 0, records: [], rngDraws: 0,
            scope: 'Generated parked behavior admitted before publication only; refused slots keep their original ordinary actor, source station and all historic RNG draws.' };
        const parkingWalk = Object.create(Pedestrians.prototype); parkingWalk.t = this;
        let nParked = 0, nTrams = 0;
        const shuffled = edges.slice(); for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
        if (pc > 0) {
            for (const e of shuffled) {
                if (nParked >= maxParked) break;
                if (isMotorway(e) || e.type === 'dn' || e.roundabout || e.len < 40 || closedEdge(e)) continue;
                const exp = e.len / 90 * pc; let n = Math.floor(exp); if (this.rng() < exp - n) n++;
                for (let i = 0; i < n; i++) {
                    const dir = this.rng.pick([1, -1]); const lanes = lanesDir(e, dir); if (!this.parkOk(e, dir)) continue;
                    const s = this.rng.range(15, e.len - 15);
                    if (junctionDist(e, s) < 30 || !free(e, dir, lanes - 1, s, 6)) continue;
                    const v = this.spawn({ edge: e, dir, lane: lanes - 1, s, kind: this.rng.pick(['hatch', 'sedan', 'van', 'hatch']) });
                    // Keep the historic attempted-slot count/loop termination and
                    // every spawn draw. A refused behavior is the same ordinary
                    // new actor, never a deleted/rerolled or later unparked car.
                    nParked++; this.initialParking.attempted++;
                    const original = { id:v.id, kind:v.kind, edgeId:e.id, sourceId:e.access?.sourceId, dir, lane:v.lane, s, x:v.x, y:v.y, z:v.z, latExtraCur:v.latExtraCur, lateralExtra:v.lateralExtra };
                    const parking = evaluateInitialParking(this, v, { desiredOffset:(e.laneW ?? 3.3)*.55, walkOffset:(edge,side)=>parkingWalk.off(edge,side) });
                    if (parking.valid) {
                        v.parked = true; v.mesh.userData.parked = true; v.speed = 0; v.hazard = true;
                        v.latExtraCur = v.lateralExtra = parking.offset;
                        v.x=parking.body.x; v.y=parking.body.y; v.z=parking.body.z; v.heading=parking.body.heading;
                        v.mesh.position.set(v.x,v.y,v.z); v.mesh.rotation.set(0,v.heading,0,'YXZ');
                        this.initialParking.admitted++;
                    } else this.initialParking.refused++;
                    const { body, ...proof } = parking;
                    this.initialParking.records.push({ original, parked:v.parked, ...proof });
                }
            }
        }
        // trams
        if (this.city.traffic?.trams) {
            for (const e of shuffled) {
                if (!e.tram || e.len < 25 || nTrams >= maxTrams) continue;
                const exp = e.len / 600; let n = Math.floor(exp); if (this.rng() < exp - n || e.len > 300) n = Math.max(n, 1);
                for (let i = 0; i < n; i++) for (const dir of [1, -1]) {
                    const tk = this.transitKind?.('tram') || 'tram', sp = this.sSpan(e, dir, this.kindLength(tk), true); if (!sp) continue;
                    const s = this.rng.range(sp[0], sp[1]);
                    if (!free(e, dir, 'tram', s, this.kindLength(tk) + 2)) continue; // 27 m V3A / 36 m Imperio
                    const v = this.spawn({ edge: e, dir, lane: 0, s, kind: tk });
                    v.tram = true; v.nextStopOdo = this.rng.range(80, 400); nTrams++;
                }
            }
        }
    }

    spawn({ edge, dir, lane, s, kind }) {
        const isTaxi = kind === 'taxi';
        let color;
        if (isTaxi) color = '#ffd400';
        else if (this.isBusKind(kind)) color = this.buc ? '#f2c230' : '#2e7d32';
        else if (/tram/.test(kind)) color = this.rng.chance(0.5) ? '#d9262c' : '#f2c230';
        else if (kind === 'police') color = this.buc ? '#f1f5f9' : '#111827';
        else color = this.rng.pick(CAR_COLORS);
        // vehicles.js fleet paint statistics / fixed liveries when available (null = the model's own livery)
        if (typeof VEH.fleetColor === 'function') { try { color = VEH.fleetColor(kind, this.city.id, this.rng) ?? undefined; } catch { /* keep */ } }
        // instanced: one draw call per kind and LOD for the whole fleet (vehicles.js), the group is moved as before
        const mesh = makeVehicle(kind, color, { city: this.city.id, instanced: VEH.fleetStats ? true : undefined });
        if (isTaxi && !mesh.userData.length) mesh.userData.length = 4.4, mesh.userData.width = 1.8;
        this.group.add(mesh);
        const lo = this.buc ? 0.95 : 1.0, hi = this.buc ? 1.25 : 1.12;
        const v = {
            id: this._idSeq++, edge, dir, lane, s, kind, mesh,
            length: mesh.userData.length || 4.4, width: mesh.userData.width || 1.8,
            speed: 0, desiredMul: this.isBusKind(kind) || kind === 'truck' ? this.rng.range(0.85, 0.95) : this.rng.range(lo, hi),
            stuck: 0, honkAt: this.rng.range(2.5, 7) / (0.3 + this.chaos), honkCd: 0,
            laneCur: lane, lateralExtra: 0, latExtraCur: 0, parked: false, tram: /tram/.test(kind), bus: this.isBusKind(kind), trolley: /trolley/.test(kind), isPolice: kind === 'police',
            busLaneOk: this.buc && kind === 'taxi' ? true : this.rng() < (this.buc ? 0.3 : 0.03), // taxis may use STB bus lanes; some drivers just do
            bubbleCd: 0, annoyed: 0, route: [], ghost: 0, odo: 0, stopDone: null, stopTimer: 0, bypass: null, bypassT: 0, dwell: 0, served: null,
            x: 0, z: 0, y: 0.24, heading: 0, fx: 0, fz: 1, rx: 1, rz: 0, layer: layerOf(edge),
            laneChangeCd: this.rng.range(1, 6), leader: null, gap: Infinity,
            still: 0, touchT: 0, waitRed: false, blockT: 0,
            long: false, hist: null,
        };
        v.long = v.length >= LONG_LEN; v.hist = [];
        if (v.isPolice) this.addLightbar(v);
        if (this.nightLights) mesh.userData.setLights?.(true);
        this.placeOnLane(v, true, 0);
        this.vehicles.push(v);
        return v;
    }

    /** real model length of a kind (vehicles.js vehicleSize), for spawn spacing of 12–36 m transit */
    kindLength(k) { try { const L = VEH.vehicleSize?.(k, this.city.id)?.length; if (L > 0) return L; } catch { /* ignore */ } return /tram/.test(k) ? 27 : /artic/.test(k) ? 18.3 : 12.5; }
    isBusKind(k) { return /bus|artic/.test(k || ''); } // bus, stb-bus, kcm-bus, kcm-artic, trolleybus…

    addLightbar(v) {
        if (v.mesh.userData.flash) { v.flash = v.mesh.userData.flash; return; }
        let bar = v.mesh.userData.lightbar;
        if (!bar) {
            bar = new THREE.Group();
            const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.28), new THREE.MeshBasicMaterial({ color: '#ff1f1f' }));
            const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.28), new THREE.MeshBasicMaterial({ color: '#1f5bff' }));
            red.position.x = -0.28; blue.position.x = 0.28; bar.add(red, blue);
            bar.position.set(0, 1.55, 0.1); v.mesh.add(bar);
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(v.width + 0.02, 0.18, v.length * 0.6), new THREE.MeshBasicMaterial({ color: this.buc ? '#1d4ed8' : '#f8fafc' }));
            stripe.position.y = 0.62; v.mesh.add(stripe);
            bar.userData.red = red; bar.userData.blue = blue;
        }
        v.lightbar = bar;
    }

    /** double-parking is allowed only on roads with ≥2 lanes in that direction (never motorways / roundabouts / trams) */
    parkOk(e, dir) {
        return lanesDir(e, dir) >= 2 && !isMotorway(e) && e.type !== 'dn' && !e.roundabout && !e.tram && !e.tunnel && !e.bridge && e.len >= 40;
    }
    /** a freshly placed vehicle must not be on top of / just in front of the player, nor overlap another vehicle */
    spawnClear(v) {
        if (v.edge.rail && (!this.railBodyInside(v) || !initialTrafficStaticClearance(this.world, v).valid)) return false;
        if (!this.sharedLanes.canPlace(v.edge, v.dir, this._bulk || this.vehicles, v)) return false;
        const P = this.player;
        if (P) {
            const dx = v.x - P.x, dz = v.z - P.z, d = Math.hypot(dx, dz);
            if (d < 18) return false;
            if (d < 40 && dx * P.fx + dz * P.fz > -4) return false; // in front of the player
        }
        let ok = true;
        if (streetLevel(v)) this.peds?.grid.query(v.x, v.z, v.length / 2 + 2, p => { if (pedestrianPen(v, p) > -0.2) ok = false; });
        if (!ok) return false;
        const check = (o) => {
            if (!ok || o === v || o.inactive || o.layer !== v.layer) return;
            const dx = o.x - v.x, dz = o.z - v.z;
            if (Math.abs(dx) > 20 || Math.abs(dz) > 20) return;
            const f = dx * v.fx + dz * v.fz, l = dx * v.rx + dz * v.rz;
            const ext = (u1, u2) => Math.abs(o.fx * u1 + o.fz * u2) * o.length / 2 + Math.abs(o.rx * u1 + o.rz * u2) * o.width / 2;
            if (Math.abs(f) < v.length / 2 + ext(v.fx, v.fz) + 2 && Math.abs(l) < v.width / 2 + ext(v.rx, v.rz) + 0.4) ok = false;
        };
        if (this._bulk) { for (const o of this._bulk) check(o); return ok; } // mass relocation: only the ones placed so far count
        if (this.grid.items) this.grid.query(v.x, v.z, 14, check); else for (const o of this.vehicles) check(o);
        // vehicles moved this frame are hashed at their old cell: check the few recently relocated ones too
        if (ok && this._recent) for (const o of this._recent) check(o);
        return ok;
    }
    noteRelocated(v) { if (v.edge.rail) { v.servedRailStop = null; v.servedRailStopOdo = null; v.dwell = 0; } v._moveGeneration = (v._moveGeneration || 0) + 1; if (this._bulk) { this._bulk.push(v); return; } const r = this._recent || (this._recent = []); r.push(v); if (r.length > 32) r.shift(); }

    /** world position for a vehicle's lane state */
    laneTarget(v, out) {
        if (v.edge.rail) {
            const p = sampleTramPath(v); if (!p) throw new Error('Unresolved native rail pose ' + v.id);
            Object.assign(out, p, { rx: -p.fz, rz: p.fx }); return out;
        }
        const e = v.edge;
        const fx = e.dirx * v.dir, fz = e.dirz * v.dir;
        const rx = e.nx * v.dir, rz = e.nz * v.dir;
        const start = v.dir > 0 ? e.a : e.b;
        let lat = v.tram ? tramOffset(e, v.dir) : laneOffset(e, v.laneCur, v.dir) + v.latExtraCur;
        if (v.latBlend) lat += v.latBlend * Math.max(0, 1 - v.s / 12);
        out.x = start.x + fx * v.s + rx * lat; out.z = start.z + fz * v.s + rz * lat;
        out.fx = fx; out.fz = fz; out.rx = rx; out.rz = rz;
        return out;
    }

    /** lateral offset of v's lane on edge e (dir): the current edge as laneTarget, others at the same lane index */
    latOn(v, e, dir, laneCur) {
        if (v.tram) return tramOffset(e, dir);
        if (e === v.edge) return laneOffset(e, v.laneCur, dir) + v.latExtraCur + (v.latBlend || 0) * Math.max(0, 1 - v.s / 12);
        return laneOffset(e, laneCur ?? clamp(v.laneCur, 0, (lanesDir(e, dir) || 1) - 1), dir) + v.latExtraCur;
    }
    /** the edge v drove before (e, dir): its history, else the only other edge at a 2-way node (null: unknown) */
    prevLink(v, e, dir, hi) {
        const st = dir > 0 ? e.a : e.b, H = v.hist;
        if (H && hi >= 0 && hi < H.length) { const h = H[hi]; if (h.e !== e && (h.dir > 0 ? h.e.b : h.e.a) === st) return { e: h.e, dir: h.dir, lat: h.lat, hi: hi - 1 }; }
        if (st.edges.length === 2) { const g = st.edges[0] === e ? st.edges[1] : st.edges[0]; if (g && g !== e) return { e: g, dir: g.b === st ? 1 : -1, hi: -1 }; }
        return null;
    }
    lanePt(v, c, s, out) {
        const e = c.e, st = c.dir > 0 ? e.a : e.b, lat = c.lat ?? this.latOn(v, e, c.dir, c.laneCur);
        out.x = st.x + e.dirx * c.dir * s + e.nx * c.dir * lat; out.z = st.z + e.dirz * c.dir * s + e.nz * c.dir * lat;
        return out;
    }
    /**
     * Point of v's lane path at signed distance `off` from its centre: the planned route ahead (never through a
     * U-turn), the edges it came from behind; across every node the path is the straight chord from the entry lane
     * point to the exit lane point (as the junction claims draw it), so a long body never pivots across a box.
     */
    pathPoint(v, off, out) {
        if (v.edge.rail) {
            const p = sampleTramPath(v, off); if (!p) throw new Error('Unresolved native rail body span ' + v.id);
            Object.assign(out, p); return out;
        }
        const S = v.s + off, seq = [{ e: v.edge, dir: v.dir, s0: 0 }];
        let end = v.edge.len, laneCur = v.laneCur;
        for (let k = 0; end < S + 8 && k < v.route.length; k++) { const r = v.route[k]; if (r.uturn) break; laneCur = clamp(laneCur, 0, (lanesDir(r.e, r.dir) || 1) - 1); seq.push({ e: r.e, dir: r.dir, s0: end, laneCur }); end += r.e.len; }
        let s0 = 0, e = v.edge, dir = v.dir, hi = (v.hist?.length ?? 0) - 1;
        for (let k = 0; s0 > S - 8 && k < 6; k++) { const p = this.prevLink(v, e, dir, hi); if (!p) break; s0 -= p.e.len; seq.unshift({ e: p.e, dir: p.dir, s0, lat: p.lat }); e = p.e; dir = p.dir; hi = p.hi; }
        let i = 0; while (i < seq.length - 1 && S >= seq[i + 1].s0) i++;
        const c = seq[i], A = this._pa || (this._pa = {}), B = this._pb || (this._pb = {});
        const pad = (a, b) => {
            const nd = a.dir > 0 ? a.e.b : a.e.a, ra = padOf(nd, a.e), rb = padOf(nd, b.e), lo = b.s0 - ra, hi2 = b.s0 + rb;
            if (S <= lo || S >= hi2) return false;
            this.lanePt(v, a, a.e.len - ra, A); this.lanePt(v, b, rb, B);
            const t = (S - lo) / (ra + rb); out.x = A.x + (B.x - A.x) * t; out.z = A.z + (B.z - A.z) * t;
            return true;
        };
        if (i + 1 < seq.length && pad(c, seq[i + 1])) return out;
        if (i > 0 && pad(seq[i - 1], c)) return out;
        return this.lanePt(v, c, S - c.s0, out);
    }
    /** centre positions [lo, hi] a vehicle of length L may take on (e, dir) when placed: long ones keep the whole body
     *  off the junction pads (no bus / tram spawned across a junction mouth); null = the edge is too short for it */
    sSpan(e, dir, L, long) {
        if (e.rail) return tramSpan(e, dir, L);
        if (!long) return [Math.min(4, e.len / 2), Math.max(e.len / 2, e.len - 4)];
        const a = dir > 0 ? e.a : e.b, b = dir > 0 ? e.b : e.a;
        const lo = Math.max(0.5, L / 2 - this.runTo(a, e, L)), hi = Math.min(e.len - 0.5, e.len - L / 2 + this.runTo(b, e, L));
        return hi > lo ? [lo, hi] : null;
    }
    /** free length beyond node n (reached along e) up to the next junction pad / dead end, through 2-way nodes (≤ cap) */
    runTo(n, e, cap) {
        let d = 0;
        for (let k = 0; k < 8 && d < cap; k++) {
            if (this.isJunction(n)) return d - (n.radius ?? 6) - 1.5;
            if (n.edges.length !== 2) return d - 1;
            const g = n.edges[0] === e ? n.edges[1] : n.edges[0];
            d += g.len; n = g.a === n ? g.b : g.a; e = g;
        }
        return d;
    }

    placeOnLane(v, snap, dt) {
        const t = this.laneTarget(v, this._t || (this._t = {}));
        v.fx = t.fx; v.fz = t.fz; v.rx = t.rx; v.rz = t.rz;
        if (!snap && v.speed === 0) {
            // A queued car holds its physical pose, including any unfinished steer.
            // Time alone must not pull the body sideways toward a planned lane.
        }
        else if (v.long && LONG_BODY) {
            // body on the path: centre between the axle points, heading along them (same while stopped, snapped or not)
            const d = v.length * 0.36, F = this.pathPoint(v, d, this._pf || (this._pf = {})), R = this.pathPoint(v, -d, this._pr || (this._pr = {}));
            const hx = F.x - R.x, hz = F.z - R.z, C = this.pathPoint(v, 0, this._pc || (this._pc = {}));
            // centre on the lane path itself (as every car), heading along the axle chord (a chord-midpoint centre cut
            // corners across the neighbouring lanes and knotted junction queues: rosetti / Bellevue finale)
            v.x = C.x; v.z = C.z;
            v.heading = hx * hx + hz * hz > 1e-6 ? Math.atan2(-hx, -hz) : Math.atan2(-t.fx, -t.fz);
        }
        else if (snap) { v.x = t.x; v.z = t.z; v.heading = Math.atan2(-t.fx, -t.fz); }
        else {
            // Follow the same junction chord as the reservations/long bodies.
            // Projecting straight onto the next road axis moved a stopped estate
            // 7.55 m at the short Aviatorilor → Victoriei link.
            const C = this.pathPoint(v, 0, this._pc || (this._pc = {}));
            const F = this.pathPoint(v, 0.5, this._pf || (this._pf = {}));
            const R = this.pathPoint(v, -0.5, this._pr || (this._pr = {}));
            const h = Math.hypot(F.x - R.x, F.z - R.z);
            t.x = C.x; t.z = C.z;
            if (h > 1e-6) { t.fx = (F.x - R.x) / h; t.fz = (F.z - R.z) / h; t.rx = -t.fz; t.rz = t.fx; }
            const dx = t.x - v.x, dz = t.z - v.z;
            const along = clamp(dx * t.fx + dz * t.fz, -v.speed * dt, v.speed * dt), lat = dx * t.rx + dz * t.rz;
            const steerDt = dt * clamp(v.speed / 3, 0, 1);
            const k = 1 - Math.exp(-(v.transition > 0 ? 5 : 9) * steerDt);
            const ox = v.x, oz = v.z;
            const side = clamp(lat * k, -0.45 * v.speed * dt, 0.45 * v.speed * dt);
            v.x += t.fx * along + t.rx * side; v.z += t.fz * along + t.rz * side;
            const mx = v.x - ox, mz = v.z - oz;
            // (after round 6: cars 'twitched' full left / right in gentle turns) the heading follows the lane, steering only by the
            // real lateral motion over the travelled distance (≤ 0.45 rad); a near-still car keeps the lane direction
            const laneH = Math.atan2(-t.fx, -t.fz), fwd = mx * t.fx + mz * t.fz;
            let tgt = laneH;
            if (fwd > 0.02) { let dA = Math.atan2(-mx, -mz) - laneH; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); tgt = laneH + clamp(dA, -0.45, 0.45); }
            v.heading = angleLerp(v.heading, tgt, 1 - Math.exp(-10 * steerDt));
        }
        const e = v.edge;
        if (e.rail) { const p = sampleTramPath(v); if (!p) throw new Error('Unresolved native rail grade'); v.y = p.y + .24; }
        else if (e.sourceBridgeGrade?.known) { v.y=e.sourceBridgeGrade.heightAtWorld(v.x,v.z)+.24; }
        else if (e.a.y !== undefined && e.b.y !== undefined) { const tt = clamp(v.dir > 0 ? v.s / e.len : 1 - v.s / e.len, 0, 1); v.y = e.a.y + (e.b.y - e.a.y) * tt + 0.24; }
        v.mesh.position.set(v.x, v.y, v.z);
        // pitch with the ramp (bridges / tunnels)
        const railF = e.rail ? sampleTramPath(v, v.length * .36) : null, railR = e.rail ? sampleTramPath(v, -v.length * .36) : null;
        const slope = e.rail ? (railF.y - railR.y) / Math.max(1e-6, Math.hypot(railF.x - railR.x, railF.z - railR.z)) : e.a.y !== undefined && e.b.y !== undefined ? (e.b.y - e.a.y) / Math.max(1, e.len) * v.dir : 0;
        let pitch = Math.atan(slope);
        if(!e.rail&&e.sourceBridgeGrade?.known){
            const d=v.length*.36,F=this.pathPoint(v,d,this._pf||(this._pf={})),R=this.pathPoint(v,-d,this._pr||(this._pr={}));
            const height=p=>this.world?.roadHeight?this.world.roadHeight(p.x,p.z,{y:v.y,edge:e})-.24:e.sourceBridgeGrade.heightAtWorld(p.x,p.z);
            pitch=Math.atan((height(F)-height(R))/Math.max(1e-6,Math.hypot(F.x-R.x,F.z-R.z)));
        }
        if (e.rail) {
            const support = fitTramBodySupport(v, { samplePath: sampleTramPath, supportAt: this.world?.tramDeckSupportAt, nativePitch: pitch });
            if (!support.known) throw new Error('Unresolved native tram body support: ' + support.reason);
            v.railSupport = support; v.y = support.y; pitch = support.pitch;
            v.mesh.position.set(v.x, v.y, v.z);
        }
        v.mesh.rotation.set(pitch, v.heading, 0, 'YXZ');
    }

    /** big (OSM) worlds: keep the simulation in a bubble around the player */
    get large() {
        if (this._large === undefined) { const b = this.world.bounds; this._large = !!b && ((b.maxX - b.minX) > 4000 || (b.maxZ - b.minZ) > 4000); }
        return this._large;
    }
    /** NPC head/tail lights (night) — applied to current and future vehicles */
    setNightLights(on) {
        this.nightLights = !!on;
        for (const v of this.vehicles) v.mesh.userData.setLights?.(this.nightLights);
    }
    setPlayer(p) {
        this.player = p;
        if (this.large) {
            // mass relocation around the new spot: each placement is checked against the ones placed before it
            // (the spatial grid still holds the old positions); vehicles that find no free spot wait in the pool
            this._bulk = [];
            const list = this.vehicles.slice();
            for (const v of list) {
                if (this.relocate(v, 0, this.bubble, false)) continue;
                const i = this.vehicles.indexOf(v); if (i >= 0) { this.vehicles.splice(i, 1); v.inactive = true; v.mesh.visible = false; this.pool.push(v); }
            }
            this._bulk = null;
            this.grid.build(this.vehicles); // admission checks the final relocated/pooled vehicle set
            this.peds.relocateAll();
        }
    }
    get bubble() { return 650; }
    /** edges around the player, cached (refreshed when the player moved 80 m or every 2 s) */
    nearEdges(r, rail = false) {
        const P = this.player; const c = this._ne || (this._ne = {});
        const k = (rail ? 'rail-r' : 'r') + r; let e = c[k];
        if (!e || Math.hypot(e.x - P.x, e.z - P.z) > 80 || this.time - e.t > 2) {
            e = c[k] = { x: P.x, z: P.z, t: this.time, list: (rail ? this.tramIndex : this.index).near(P.x, P.z, r, []).filter(ed => ed.len >= 8) };
        }
        return e.list;
    }
    /** Automatic recycling must keep both the old and new body out of view. */
    inView(v) {
        const P = this.walker?.active ? this.walker : this.player; if (!P) return false;
        const dx = v.x - P.x, dz = v.z - P.z, d = Math.hypot(dx, dz);
        if (d < 70 || (d < 230 && dx * P.fx + dz * P.fz > -2)) return true;
        const G = globalThis.game;
        if (G?.traffic !== this) return false;
        if (!this._recoveryViews || this._recoveryViewFrame !== this._frame) {
            this._recoveryViewFrame = this._frame; this._recoveryViews = [];
            const cameras = [this.observerCamera || G.camera];
            if (!this.observerCamera && !this.walker?.active && this.player?.mirrorEnabled) cameras.push(this.player.mirrorCam);
            for (const camera of cameras) if (camera) {
                camera.updateWorldMatrix(true, false);
                const matrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), m = camera.matrixWorld.elements;
                this._recoveryViews.push({ frustum: new THREE.Frustum().setFromProjectionMatrix(matrix), x: m[12], y: m[13], z: m[14], far: Math.min(RECOVERY_VIEW_FAR_M, camera.far) });
            }
        }
        const sphere = this._recoverySphere || (this._recoverySphere = new THREE.Sphere());
        sphere.center.set(v.x, (v.y ?? 0.24) + 1, v.z);
        // Include the model and the fleet renderer's frustum padding. This only
        // guards a relocation; camera planes, LODs and draw population stay native.
        sphere.radius = (v.mesh?.userData?._model?.radius ?? Math.hypot(v.length || 5, v.width || 2, 4) / 2) + 8;
        // A frustum has no depth limit short of the 5 km far plane: facing the district, almost every vehicle in it
        // counted as "in view", so no stalled queue was ever recovered and the gridlock only grew. Beyond
        // RECOVERY_VIEW_FAR_M a car is smaller on screen than a person at the pedestrians' own 300 m limit.
        return this._recoveryViews.some(view => Math.hypot(v.x - view.x, sphere.center.y - view.y, v.z - view.z) - sphere.radius < view.far && view.frustum.intersectsSphere(sphere));
    }
    savePose(v) {
        const keys = ['edge', 'dir', 's', 'lane', 'laneCur', 'lateralExtra', 'latExtraCur', 'layer', 'speed', 'x', 'z', 'y', 'heading', 'fx', 'fz', 'rx', 'rz', 'latBlend', 'transition', 'stuck', 'still', 'touchT', 'blockT', 'ghost', 'bypass', 'served', 'dwell'];
        const pose = {}; for (const k of keys) pose[k] = v[k];
        pose.route = v.route.slice(); if (v.hist) pose.hist = v.hist.slice(); pose.rotation = v.mesh.rotation.clone(); return pose;
    }
    restorePose(v, pose) {
        const { rotation, ...state } = pose; Object.assign(v, state); v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.copy(rotation);
    }
    /** move vehicle v onto a random edge whose midpoint is rMin..rMax from the player. returns success */
    relocate(v, rMin, rMax, hidden) {
        const P = this.player; if (!P || (hidden && v.mesh.visible !== false && this.inView(v))) return false;
        const cands = this.nearEdges(rMax <= this.bubble ? this.bubble : rMax, !!v.edge.rail);
        if (!cands.length) return false;
        const save = this.savePose(v);
        for (let tries = 0; tries < 60; tries++) {
            const e = cands[Math.floor(this.rng() * cands.length)];
            if (e.len < 8 || (e.main === false && !v.tram) || closedEdge(e)) continue;
            if (v.tram !== !!e.tram && v.tram) continue;
            if (v.parked && !(this.parkOk(e, 1) || this.parkOk(e, -1))) continue;
            if (v.bus && isMotorway(e)) continue;
            if (v.trolley && !e.trolleyWire && (this.transit?.trolleyEdges || 0) > 0) continue; // trolleybuses stay under their wires
            if (v.bus && !v.trolley && !e.busRoute && (this.transit?.busEdges || 0) > 0 && this.rng() < 0.85) continue;
            const mul = trafficMulOf(e);
            if (this.rng() > Math.min(1, mul * 0.6 + 0.08)) continue;
            const mx = (e.a.x + e.b.x) / 2 - P.x, mz = (e.a.z + e.b.z) / 2 - P.z; const d = Math.hypot(mx, mz);
            if (d < rMin || d > rMax) continue;
            if (hidden && d < 600 && (mx * P.fx + mz * P.fz) > 0) continue; // ahead & near: would pop in view
            let dir = this.rng() < 0.5 ? 1 : -1; if (!actorCanTravel(e, dir, v)) dir = -dir; if (!actorCanTravel(e, dir, v)) continue;
            if (v.parked && !this.parkOk(e, dir)) { dir = -dir; if (!this.parkOk(e, dir)) continue; }
            const lanes = lanesDir(e, dir);
            const sp = v.parked ? [15, e.len - 15] : this.sSpan(e, dir, v.length, v.long); if (!sp) continue;
            const s = this.rng.range(sp[0], sp[1]);
            if (v.parked && junctionDist(e, dir > 0 ? s : e.len - s) < 30) continue;
            v.edge = e; v.dir = dir; v.s = s; v.route.length = 0; v.layer = layerOf(e); v.latBlend = 0; if (v.hist) v.hist.length = 0;
            v.lane = v.laneCur = v.parked || v.bus ? lanes - 1 : this.rng.int(0, this.carLaneMax(e, dir, v));
            v.speed = v.parked ? 0 : Math.min(edgeSpeed(e) * 0.7, 8); v.stuck = 0; v.still = 0; v.touchT = 0; v.blockT = 0; v.ghost = 0; v.bypass = null; v.served = null; v.dwell = 0;
            if (!v.parked) v.latExtraCur = v.lateralExtra = 0; else v.latExtraCur = v.lateralExtra = (e.laneW ?? 3.3) * 0.55;
            this.placeOnLane(v, true, 0);
            if ((hidden && this.inView(v)) || !this.spawnClear(v)) continue; // check the actual body, not only the edge midpoint
            this.noteRelocated(v);
            return true;
        }
        // no free spot: put it back where it was (a failed try must not leave it overlapping someone)
        this.restorePose(v, save);
        return false;
    }
    recycle() {
        const P = this.player; if (!P) return;
        this.peds.recycle(); // (districts too: walkers stay around the player)
        if (!this.large) return;
        const all = this.vehicles; const n = Math.min(all.length, 25);
        const R = this.bubble + 100;
        for (let k = 0; k < n; k++) {
            this._rr = ((this._rr || 0) + 1) % all.length;
            const v = all[this._rr];
            const d = Math.hypot(v.x - P.x, v.z - P.z);
            if (d > R) this.relocate(v, 350, this.bubble, true);
        }
    }

    // ------------------------------------------------------------------ routing
    turnLaneAllows(e, dir, lane, next, v) {
        return v?.tram || laneTurnAllowed(this.turnLaneRules, e, dir, lane, next?.e, next?.dir) &&
            (!next || motorTurnAllowed(this.motorTurnRestrictions,e,dir,next.e,next.dir,{mode:motorRestrictionMode(v)}) && sourceRoadClearance(this.world?.data,next.e,v).eligible===true);
    }
    /** Constructor planning normally has no motor routes: spawnAll consumes no
     * route-choice RNG. Still expose any invalid supplied/bound future turn,
     * especially one whose pad/body span could already influence publication. */
    auditMotorRouteTurns() {
        const invalid = []; let vehicles = 0, transitions = 0;
        for (const v of this.vehicles) {
            if (v.tram || v.edge?.rail) continue; vehicles++;
            let e = v.edge, dir = v.dir, distance = e.len - v.s;
            for (let i = 0; i < v.route.length; i++) {
                const next = v.route[i]; transitions++;
                if (!motorTurnAllowed(this.motorTurnRestrictions,e,dir,next.e,next.dir,{mode:motorRestrictionMode(v)})) {
                    const node = dir > 0 ? e.b : e.a, blend = Math.min(Math.max(node.radius??0,3),e.len*.45);
                    invalid.push({vehicleId:v.id,index:i,fromSourceId:e.access?.sourceId??e.sourceId,toSourceId:next.e.access?.sourceId??next.e.sourceId,viaSourceId:node.sourceId,distanceToViaM:distance,bodyPadMayInfluencePose:distance <= v.length/2+blend});
                }
                distance += next.e.len; e = next.e; dir = next.dir;
            }
        }
        return {passed:invalid.length===0,vehicles,transitions,invalid,rngDraws:0,scope:'Declared motor-route source turns only; full emitted body/grade/static clearance remains a separate admission gate. Invalid futures are revalidated before physical motion; no actor hiding or constructor RNG reroll.'};
    }
    keepsTurnLane(e, dir, next) {
        return !!next && !next.uturn && preservesTurnLane(this.turnLaneRules, e, dir, next.e, next.dir);
    }
    laneOnNext(v, lane, e, dir) {
        return v.bus ? Math.max(0, lanesDir(e, dir) - 1) : clamp(lane, 0, this.carLaneMax(e, dir, v));
    }
    routeLaneAt(v, edge, dir) {
        let lane = v.lane;
        if (edge === v.edge && dir === v.dir) return lane;
        for (const r of v.route) {
            lane = this.laneOnNext(v, lane, r.e, r.dir);
            if (r.e === edge && r.dir === dir) return lane;
        }
        return lane;
    }
    chooseNext(e, dir, v, lane = v.lane) {
        if (e.rail) {
            if (!v.tram) return null;
            const choices = tramContinuations(e, dir);
            choices.sort((a, b) => Number(b.e.sourceId === e.sourceId) - Number(a.e.sourceId === e.sourceId) || (b.e.dirx * b.dir * e.dirx * dir + b.e.dirz * b.dir * e.dirz * dir) - (a.e.dirx * a.dir * e.dirx * dir + a.e.dirz * a.dir * e.dirz * dir) || String(a.e.id).localeCompare(String(b.e.id)));
            return choices[0] || null;
        }
        const node = dir > 0 ? e.b : e.a;
        const fx = e.dirx * dir, fz = e.dirz * dir;
        let best = null, total = 0;
        const cands = this._cands || (this._cands = []); cands.length = 0;
        for (const n of node.edges) {
            if (n === e) continue;
            const nd = n.a === node ? 1 : -1;
            if (!canTravel(n, nd) || !ambientTrafficAccess(n)) continue;
            if (v.tram && !n.tram) continue;
            if (!v.tram && n.tram && n.tramOnly) continue;
            if (!this.turnLaneAllows(e, dir, lane, { e: n, dir: nd }, v)) continue;
            if (n.type === 'service' && !v.isPolice && this.rng() < 0.8) continue;
            if ((nd > 0 ? n.b : n.a).mapEnd) continue; // toward a district-edge closure: turn off before it
            if (n.main === false && e.main !== false && !v.tram) continue; // never drive into a one-way trap
            const dot = n.dirx * nd * fx + n.dirz * nd * fz;
            let w = (1 + Math.max(0, dot) * 2.5) * (0.4 + trafficMulOf(n));
            if (dot < -0.6) w *= v.long ? 0.002 : 0.05; // avoid hairpins (a long body can't make them)
            if (e.name && n.name === e.name) w *= 5;
            if (v.trolley && this.transit?.trolleyEdges) w *= n.trolleyWire ? 20 : 0.02;      // under the wires
            else if (v.bus && this.transit?.busEdges) w *= n.busRoute ? 8 : 0.15;             // along its route
            if (e.roundabout && n.roundabout) w *= 1.5;
            if (this.park?.blockEdge === n && (lanesDir(n, nd) || 1) <= 1 && !v.service) w *= 0.03; // the player's car left in the only lane: go round
            cands.push({ n, nd, w }); total += w;
        }
        if (!cands.length) {
            // (long vehicles never U-turn on the carriageway — an 18 m bus turning on the spot stands broadside across the
            //  road: the route ends here and the vehicle is respawned elsewhere when it reaches the end)
            if (canTravel(e, -dir) && !e.roundabout && !v.long && this.turnLaneAllows(e, dir, lane, { e, dir: -dir }, v)) return { e, dir: -dir, uturn: true };
            return null;
        }
        let r = this.rng() * total;
        for (const c of cands) { r -= c.w; if (r <= 0) { best = c; break; } }
        best = best || cands[cands.length - 1];
        return { e: best.n, dir: best.nd };
    }
    ensureRoute(v) {
        const R = v.route;
        let lane = v.lane, from = v.edge, dir = v.dir;
        for (let i = 0; i < R.length; i++) {
            const next = R[i];
            if (!this.turnLaneAllows(from, dir, lane, next, v)) { R.length = i; break; }
            lane = this.laneOnNext(v, lane, next.e, next.dir); from = next.e; dir = next.dir;
        }
        let dist = v.edge.len - v.s;
        for (const r of R) dist += r.e.len;
        let last = R.length ? R[R.length - 1] : { e: v.edge, dir: v.dir };
        while ((dist < 140 || R.length < 2) && R.length < 24) {
            const nx = this.chooseNext(last.e, last.dir, v, lane);
            if (!nx) break;
            R.push(nx); dist += nx.e.len; last = nx;
            lane = this.laneOnNext(v, lane, nx.e, nx.dir);
            if (nx.uturn) break;
        }
    }
    advance(v) {
        const e = v.edge, odir = v.dir;
        const nx = v.route.shift();
        if (!nx) {
            // A route-ending bus waits at the end while visible; recycling it is
            // deferred until hidden, rather than driving it beyond its last edge.
            if (!this.respawn(v)) { v.s = Math.min(v.s, e.len - 0.1); v.speed = 0; }
            return;
        }
        (v._sh || (v._sh = [])).push(nx);
        const oldLat = v.tram ? tramOffset(e, v.dir) : laneOffset(e, v.laneCur, v.dir) + v.latExtraCur + (v.latBlend || 0) * Math.max(0, 1 - v.s / 12);
        if (v.hist) { v.hist.push({ e, dir: odir, lat: oldLat }); if (v.hist.length > (e.rail ? 256 : 6)) v.hist.shift(); }
        this.sharedLanes.advance(v, e, odir, nx.e, nx.dir, odir > 0 ? e.b : e.a);
        v.s -= e.len;
        if (v.s < 0) v.s = 0;
        v.edge = nx.e; v.dir = nx.dir; v.layer = layerOf(nx.e);
        const lanes = lanesDir(nx.e, nx.dir) || 1;
        if (v.bus) v.lane = lanes - 1;
        else if (lanes > lanesDir(e, odir) && this.buc && this.rng() < 0.12) { const l = this.rng.int(0, lanes - 1); if (Math.abs(l - v.lane) <= 1 && l < lanes && this.laneFree(v, l)) v.lane = l; }
        v.lane = clamp(v.lane, 0, v.bus || v.tram || v.isPolice ? lanes - 1 : this.carLaneMax(nx.e, nx.dir, v));
        v.laneCur = clamp(v.laneCur, 0, lanes - 1);
        if (nx.uturn) { v.laneCur = v.lane; v.transition = 1.2; v.latBlend = 0; }
        else {
            v.transition = 0.6;
            // lane centres of consecutive edges rarely line up (median / lane width / lane count changes): carry the
            // lateral offset over and blend it into the new lane over the first 12 m instead of jumping sideways
            const dot = (e.nx * odir) * (nx.e.nx * nx.dir) + (e.nz * odir) * (nx.e.nz * nx.dir);
            const newLat = v.tram ? tramOffset(nx.e, nx.dir) : laneOffset(nx.e, v.laneCur, nx.dir) + v.latExtraCur;
            v.latBlend = dot > 0.7 && !v.long && !e.sharedLane && !nx.e.sharedLane ? clamp(oldLat * dot - newLat, -4, 4) : 0; // shared mouths use the continuous junction chord
        }
    }
    /** move a vehicle somewhere else in the city, out of sight of the player */
    respawn(v, hidden = true) {
        if (hidden && v.mesh.visible !== false && this.inView(v)) return false;
        const original = this.savePose(v);
        v._resp = true; v.latBlend = 0;
        if (this.large && this.relocate(v, 300, this.bubble, hidden)) return true;
        const edges = v.edge.rail ? this.tramNetwork.edges : this.world.graph.edges; const P = this.player;
        for (let tries = 0; tries < 30; tries++) {
            const e = edges[Math.floor(this.rng() * edges.length)];
            if (v.tram && !e.tram) continue;
            if (v.trolley && !e.trolleyWire && (this.transit?.trolleyEdges || 0) > 0 && tries < 25) continue;
            let dir = actorCanTravel(e, 1, v) ? (actorCanTravel(e, -1, v) && this.rng() < 0.5 ? -1 : 1) : (actorCanTravel(e, -1, v) ? -1 : 0);
            if (!dir || e.len < 8 || closedEdge(e)) continue;
            const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
            if (P && Math.hypot(mx - P.x, mz - P.z) < 180) continue;
            // double-parked cars only where double-parking is possible (≥ 2 lanes, ≥ 30 m from a junction), at the kerb —
            // not in the middle of any lane anywhere (they were respawned into single-lane streets and junction mouths)
            if (v.parked && !this.parkOk(e, dir)) { dir = -dir; if (!canTravel(e, dir) || !this.parkOk(e, dir)) continue; }
            const PK = v.parked;
            const sp = PK ? [15, e.len - 15] : v.long ? this.sSpan(e, dir, v.length, true) : [2, e.len - 2]; if (!sp || sp[1] <= sp[0]) continue;
            const s = this.rng.range(sp[0], sp[1]);
            if (PK && junctionDist(e, dir > 0 ? s : e.len - s) < 30) continue;
            v.edge = e; v.dir = dir; v.s = s; v.route.length = 0; v.speed = 0; if (v.hist) v.hist.length = 0; v.stuck = 0; v.still = 0; v.touchT = 0; v.layer = layerOf(e);
            const lanes = lanesDir(e, dir) || 1;
            v.lane = v.laneCur = PK || v.bus ? lanes - 1 : clamp(v.lane, 0, this.carLaneMax(e, dir, v)); v.bypass = null;
            v.latExtraCur = v.lateralExtra = PK ? (e.laneW ?? 3.3) * 0.55 : 0;
            this.placeOnLane(v, true, 0);
            if ((hidden && this.inView(v)) || !this.spawnClear(v)) continue;
            this.noteRelocated(v);
            return true;
        }
        // Failed candidates must preserve the physical pose and unfinished steering.
        this.restorePose(v, original);
        return false;
    }

    // ------------------------------------------------------------------ main update
    update(dt) {
        const t0 = performance.now();
        this.time += dt;
        dt = Math.min(dt, 0.05);
        if (dt <= 0) return;
        this._dt = dt;
        const all = this.vehicles;
        this.sharedLanes.update(all, this.player, this.time);
        this.syncSignalOccupancy();
        this.grid.build(all);
        this.peds.buildGrid();
        this._frame = (this._frame || 0) + 1;
        const P = this.player, lod = this.large && P;
        if (P) P.stillT = Math.abs(P.speed) < 0.5 ? (P.stillT || 0) + dt : 0; // (mutual waits with a stopped player, stepVehicle)
        for (let i = 0; i < all.length; i++) {
            const v = all[i];
            if (v.parked) { v.honkCd -= dt; continue; }
            // LOD: far vehicles (out of the interesting area) step every other frame with 2·dt
            if (lod) {
                const dx = v.x - P.x, dz = v.z - P.z;
                if (dx * dx + dz * dz > 90000) { if (((this._frame + v.id) & 1) === 0) continue; this.stepVehicle(v, Math.min(dt * 2, 0.08)); continue; }
            }
            this.stepVehicle(v, dt);
        }
        this.overlapGuard();
        this.pedestrianGuard();
        // vehicles touching the player for > 3 s get nudged away (incl. parked ones)
        if (P) {
            for (const v of this.near(P.x, P.z, 12)) {
                if (Math.abs((P.y ?? 0.24) - v.y) > 2.5) { v.touchT = 0; continue; }
                if (vpPen(v, P) > -0.15) { v.touchT += dt; if (v.touchT > 3) this.nudge(v); }
                else v.touchT = Math.max(0, v.touchT - dt);
            }
        }
        this._dlT = (this._dlT || 0) + dt;
        if (this._dlT > 1) { this._dlT = 0; this.resolveDeadlocks(); }
        this.playerWatchdog(dt);
        if ((this._frame & 31) === 0) this.pruneBoxes();
        this._rbT = (this._rbT || 0) + dt;
        if (this._rbT > 0.25) { this._rbT = 0; this.rebalance(2); }
        this.recycle();
        this.grid.build(this.vehicles); // positions changed (guard / relocations): pedestrians test against the final boxes
        this.peds.update(dt);           // last, so nobody is left inside a vehicle that moved this frame
        try { this.updateParking(dt); } catch (e) { if (!this._parkErr) { this._parkErr = true; console.warn('[traffic] parking', e); } }
        if (this._recent) this._recent.length = 0;
        this.syncSignalOccupancy();
        if (this.world.updateLights) this.world.updateLights(this.time, this.cycle);
        // police lights
        const on = (this.time * 4 | 0) % 2 === 0;
        for (const p of this.police) {
            if (p.flash) p.flash(this.time);
            else if (p.lightbar?.userData.red) { p.lightbar.userData.red.visible = on; p.lightbar.userData.blue.visible = !on; }
        }
        this.stats.updateMs = this.stats.updateMs * 0.9 + (performance.now() - t0) * 0.1;
        this.stats.lastMs = performance.now() - t0;
    }

    stepVehicle(v, dt) {
        // snapshot for the vehicle↔vehicle overlap guard (Traffic.update)
        v._f = this._frame; v._s0 = v.s; v._odo0 = v.odo; v._x0 = v.x; v._z0 = v.z; v._h0 = v.heading; v._e0 = v.edge;
        v._lc0 = v.laneCur; v._le0 = v.latExtraCur; v._fx0 = v.fx; v._fz0 = v.fz; v._rx0 = v.rx; v._rz0 = v.rz; v._tr0 = v.transition;
        v._d0 = v.dir; v._ln0 = v.lane; v._ly0 = v.layer; v._y0 = v.y; v._lb0 = v.latBlend || 0; v._resp = false; if (v._sh) v._sh.length = 0; v._hl0 = v.hist ? v.hist.length : 0;
        if (v.edge.rail) v._railHist0 = v.hist?.slice();
        { const P0 = this.player; v._pp0 = P0 && Math.abs(P0.x - v.x) < 16 && Math.abs(P0.z - v.z) < 16 && Math.abs((P0.y ?? 0.24) - v.y) < 2.5 ? vpPen(v, P0) : undefined; }
        this.ensureRoute(v);
        const e = v.edge, L = e.len, half = v.length / 2;
        const lim = v.tram ? (e.rail ? Math.min(11, edgeSpeed(e)) : 11) : edgeSpeed(e);
        let desired = lim * (v.tram ? 1 : v.desiredMul) * (this.weatherMul ?? 1); // rain / snow: everyone drives slower
        // congestion hotspot: crawl, with stop-and-go waves (queues build behind the ones that stop)
        if (this.jamMax > 0.01) { if (((this._frame + v.id) & 7) === 0) v.jam = this.jamAt(v.x, v.z); } else v.jam = 0;
        const jam = v.jam || 0;
        if (jam > 0.05 && !v.tram && !v.isPolice) {
            desired *= 1 - 0.82 * jam;
            if (v.jamHold > 0) v.jamHold -= dt;
            else if (jam > 0.25 && v.speed > 0.5 && this.rng() < jam * 0.3 * dt && !this.playerBehind(v, 70)) v.jamHold = this.rng.range(2, 6) * jam; // (never right in front of the player: they can creep through)
        } else v.jamHold = 0;
        const P = this.player;
        // ---------------- obstacles (cone scan via grid) ----------------
        let gap = Infinity, leader = null, leaderSpeed = 0, leaderCross = false;
        const look = clamp(10 + v.speed * 2.4, 14, 55);
        const endNode = v.dir > 0 ? e.b : e.a, startNode = v.dir > 0 ? e.a : e.b;
        const endRad = endNode.radius ?? 6;
        const toEntry = L - v.s - half - endRad; // front bumper → edge of the junction box ahead
        const nearEnd = toEntry < 12;
        // already committed to (inside) a junction box: clear it instead of stopping in it
        const inJunction = (this.isJunction(endNode) && toEntry < -0.5) || (this.isJunction(startNode) && v.s - half < (startNode.radius ?? 6) - 0.5);
        // scan axes: the lane direction on a straight, the body (as drawn) while turning through a box / blending lanes
        const useH = inJunction || v.transition > 0 || Math.abs(v.latBlend || 0) > 0.3;
        const fx = useH ? -Math.sin(v.heading) : v.fx, fz = useH ? -Math.cos(v.heading) : v.fz, rx = -fz, rz = fx;
        if (v.ghost > 0) v.ghost -= dt;
        {
            this.grid.query(v.x + fx * look * 0.5, v.z + fz * look * 0.5, look * 0.5 + 8, (o) => {
                if (o === v || o === v.bypass) return;
                const dx = o.x - v.x, dz = o.z - v.z;
                const f = dx * fx + dz * fz; if (f <= 0 || f > look + o.length * 0.5) return;
                if (o.layer !== v.layer) return;
                const l = dx * rx + dz * rz;
                const ofx = -Math.sin(o.heading), ofz = -Math.cos(o.heading), orx = -ofz, orz = ofx;
                const ol = Math.abs(ofx * rx + ofz * rz) * o.length * 0.5 + Math.abs(orx * rx + orz * rz) * o.width * 0.5;
                if (Math.abs(l) > v.width * 0.5 + ol + 0.3) return;
                const hd = ofx * fx + ofz * fz;
                if (hd < -0.3) return; // oncoming
                if (o.leader === v && v.speed < 0.5 && o.speed < 0.5 && v.id < o.id) return; // each waiting for the other (merge / box): the lower id goes
                const of = Math.abs(ofx * fx + ofz * fz) * o.length * 0.5 + Math.abs(orx * fx + orz * fz) * o.width * 0.5;
                let g = f - half - of;
                const cross = hd < 0.5;
                if (cross) {
                    // mutual block (both waiting for each other): the lower id goes first
                    if (o.leader === v && v.id < o.id) return;
                    if (inJunction) { if (g > 2.5) return; } // committed: only avoid an imminent touch
                    else {
                        if (f > 14 && !nearEnd) return;
                        if (toEntry > 0) g = Math.min(g, toEntry - 0.5); // yield at the line, not inside the box
                    }
                }
                if (g < gap) { gap = g; leader = o; leaderSpeed = cross ? 0 : o.speed * hd; leaderCross = cross; }
            });
        }
        // the player is a car like any other (any orientation: use its projected rectangle) — on the same level only
        if (P && Math.abs((P.y ?? 0.24) - v.y) < 2.5) {
            const dx = P.x - v.x, dz = P.z - v.z;
            if (Math.abs(dx) < 80 && Math.abs(dz) < 80) {
                const f = dx * fx + dz * fz, l = dx * rx + dz * rz;
                // (a stopped player that is behind us in its own direction — a merge — waits for us, not we for it)
                const aheadOfP = (v.x - P.x) * P.fx + (v.z - P.z) * P.fz;
                // (crossing / merging: the NPC is in front of a stopped player that waits for it, and has waited > 4 s
                //  itself — both would wait for each other forever: the NPC goes, unless a touch is imminent)
                const mutual = Math.abs(P.speed) < 0.5 && (P.stillT || 0) > 4 && v.stuck > 4 && f - half - playerExtent(P, fx, fz) > 0.6;
                if (f > 0 && f < look + 8 && Math.abs(l) < v.width * 0.5 + playerExtent(P, rx, rz) + 0.35 && !mutual && !(aheadOfP > 2.5 && Math.abs(P.speed) < 0.5 && f - half - playerExtent(P, fx, fz) > 0.4)) {
                    const g = f - half - playerExtent(P, fx, fz);
                    if (g < gap) { gap = g; leader = P; leaderSpeed = Math.max(0, P.speed * (P.fx * fx + P.fz * fz)); leaderCross = false; }
                }
            }
        }
        // the player on foot (spec 14): a pedestrian cars stop for (and honk at, in Bucharest)
        const W = this.walker;
        if (W && W.active && Math.abs(W.y - (v.y - 0.24)) < 2) {
            const dx = W.x - v.x, dz = W.z - v.z;
            if (Math.abs(dx) < 70 && Math.abs(dz) < 70) {
                const f = dx * fx + dz * fz, l = dx * rx + dz * rz;
                if (f > 0 && f < look && Math.abs(l) < v.width * 0.5 + 0.9) {
                    const g = f - half - 0.8;
                    if (g < gap) { gap = g; leader = 'ped'; leaderSpeed = 0; leaderCross = false; }
                    if (this.buc && g < 8 && v.speed < 1 && v.honkCd <= 0 && this.rng() < 0.02) { v.honkCd = 6; this.honk(v, 'honkedAt'); }
                }
            }
        }
        const pg = this.peds.obstacleGap(v, look, dt);
        if (pg < gap) { gap = pg; leader = 'ped'; leaderSpeed = 0; leaderCross = false; }
        if (leader === P && P && Math.abs(P.speed) < 1.2 && gap < 14) v.blockT += dt; else v.blockT = Math.max(0, v.blockT - dt * 2);

        // ---------------- path constraints: lights, stops, zebras, turns ----------------
        const laneDropMax = this.laneDropMax(v, 60);
        if (!v.tram && v.lane > laneDropMax && this.laneFree(v, v.lane - 1)) { v.lane--; v.laneChangeCd = 2; }
        let stopD = Infinity, vCap = Infinity, waitingRed = false, stopWhy = null;
        let curE = e, curDir = v.dir, curLane = v.lane, curLaneCur = v.laneCur, D = L - v.s - half, prevNode = null, prevD = 0;
        const seenSignals = new Set();
        const maxLook = Math.max(70, v.speed * v.speed / 4 + 30);
        for (let k = -1; k < v.route.length && D < maxLook; k++) {
            const node = curDir > 0 ? curE.b : curE.a;
            const nxt = v.route[k + 1];
            const rad = node.radius ?? 6;
            if (curE.rail && !nxt) {
                // The whole body stops before an unresolved grade/source or
                // activity-boundary leaf. No extension onto unmodeled rails.
                const clearance = this.isJunction(node) ? rad + 1.5 : .1;
                if (D - clearance < stopD) { stopD = Math.max(0, D - clearance); stopWhy = 'rail-source-boundary'; }
            }
            if (curE.rail && (node.tags?.railway === 'tram_stop' || node.tags?.public_transport === 'stop_position') &&
                !(v.servedRailStop === node.sourceId && v.odo - (v.servedRailStopOdo || 0) < v.length + 5)) {
                const centerDistance = D + half;
                if (centerDistance >= -.5) {
                    if (centerDistance < .6 && v.speed < .5) {
                        v.dwell += dt; // gameplay dwell estimate; source fixes location only
                        if (v.dwell > 5) { v.servedRailStop = node.sourceId; v.servedRailStopOdo = v.odo; v.dwell = 0; }
                        else if (0 < stopD) { stopD = 0; stopWhy = 'rail-stop'; }
                    } else if (centerDistance < stopD) { stopD = Math.max(0, centerDistance); stopWhy = 'rail-stop'; }
                }
            }
            if (nxt?.e.sharedLane && this.sharedLanes.entry(curE, curDir)?.group !== this.sharedLanes.entry(nxt.e, nxt.dir)?.group) {
                const entryDistance = D - rad - this.sharedLanes.mouthClearance(curE, curDir, nxt.e);
                if (entryDistance < Math.max(12, v.speed * v.speed / 9 + 3) && D - rad - 1.6 > -.5 && !this.sharedLanes.canEnter(v, nxt.e, nxt.dir)) {
                    if (entryDistance < stopD) { stopD = Math.max(0, entryDistance); stopWhy = 'shared-lane'; }
                    break;
                }
            }
            if (node.hasLight && !v.isPolice) {
                const controller = this.boxController(node);
                const committed = this.boxes.get(controller)?.some(r => r.v === v && this.inBox(r, controller) && r.entered);
                // A turn/short link within one controller is one movement. Its entry
                // signal governs; once admitted the car clears all of the split box.
                const st = committed || seenSignals.has(controller) ? 'green' : this.lightState(node, curE);
                seenSignals.add(controller);
                let d = D - rad - 1.6;
                if (d > -0.5 && (st === 'red' || (st === 'yellow' && d > v.speed * 1.1))) {
                    // A separate downstream controller must be clear before entering
                    // a link too short to hold the car. Waiting never grants red entry.
                    if (k >= 0 && prevNode && this.isJunction(prevNode) && curE.len - (prevNode.radius ?? 6) - rad < v.length + 4) {
                        const dPrev = prevD - (prevNode.radius ?? 6) - 1.6;
                        if (dPrev > -0.5) d = dPrev;
                        else d = Infinity;
                    }
                    if (d !== Infinity) { if (d < stopD) { stopD = d; stopWhy = 'light'; } if (d < 10) waitingRed = true; break; }
                }
            }
            if (node.stop && v.stopDone !== node) {
                const d = D - rad - 1;
                if (d < 1.5 && v.speed < 0.6) { v.stopTimer += dt; if (v.stopTimer > 1.0) { v.stopDone = node; v.stopTimer = 0; } }
                if (v.stopDone !== node) { if (d < stopD) { stopD = d; stopWhy = 'stop'; } break; }
            }
            if ((node.crossing || node.hasLight) && this.peds.crossingAt(node)) {
                const d = D - rad - 3.5; if (d > -1) { if (d < stopD) { stopD = d; stopWhy = 'zebra'; } break; }
            }
            if (nxt && nxt.e.roundabout && !curE.roundabout && this.roundaboutBusy(node, v)) { if (D - rad - 1 < stopD) { stopD = D - rad - 1; stopWhy = 'rbt'; } break; }
            // don't block the box: if the queue beyond the junction leaves no room for us, wait at the line
            if (k === -1 && this.isJunction(node) && D - rad > 0.5 && leader && leader !== 'ped' && !leaderCross && leaderSpeed < 2) {
                const entry = D - rad;
                if (gap > entry - 0.5 && gap < entry + 2 * rad + v.length + 1.5) { const _d = entry - 0.5; if (_d < stopD) { stopD = _d; stopWhy = 'box-full'; } }
            }
            if (v.bus) { const bs = this.busStopAhead(v, curE, curDir, D, k === -1); if (bs < stopD) { stopD = bs; stopWhy = 'busstop'; } }
            // junction box reservation: a car about to enter the box claims its path across the pad (entry lane point →
            // exit lane point); a car whose path would cross / merge with a claimed one waits at the line
            if (k === -1 && nxt && this.isJunction(node) && !inJunction && !nxt.uturn) {
                const reach = Math.max(9, v.speed * v.speed / 9 + 3);
                if (D - rad < reach) {
                    const res = this.boxCheck(v, curE, curDir, nxt, node, rad);
                    if (res === 'wait' && D - rad - 0.8 > -0.3) { const _d = D - rad - 0.8; if (_d < stopD) { stopD = _d; stopWhy = 'claim'; } } // (already over the line: committed, clear the box)
                    else if (res !== 'wait' && D - rad < Math.max(4, v.speed * 0.6 + 2)) this.boxClaim(v, node, res);
                    else if (res === 'wait') this.boxClaim(v, node, this.boxPath(v, curE, curDir, nxt, rad));
                }
            }
            // lane drop ahead (next edge has fewer lanes): merge before the end of this edge, or wait at the end
            // instead of being squeezed sideways onto a car in the remaining lane
            if (nxt && !v.tram && !nxt.uturn && D < 60 && !this.keepsTurnLane(curE, curDir, nxt)) {
                const nl = Math.max(1, lanesDir(nxt.e, nxt.dir));
                if (curLane > nl - 1) {
                    // wait for a gap before the line; already at / past it (or waited long): merge on the move,
                    // car-following and the junction claim keep it off the others (a stop inside the box locks the junction)
                    if (D - rad - 1.5 > -0.5 && v.stuck < 3) { const _d = D - rad - 1.5; if (_d < stopD) { stopD = _d; stopWhy = 'lanedrop'; } }
                } else {
                    const _d = this.laneDropStop(v, nl, D, rad, curLaneCur);
                    if (_d < stopD) { stopD = _d; stopWhy = 'lanedrop2'; }
                }
            }
            if (!nxt) break;
            const ang = Math.abs(nxt.uturn ? Math.PI : turnAngle(curE.dirx * curDir, curE.dirz * curDir, nxt.e.dirx * nxt.dir, nxt.e.dirz * nxt.dir));
            if (ang > 0.22) {
                const vTurn = ang > 2.6 ? 2.5 : Math.max(4.5, desired - (desired - 5) * clamp((ang - 0.22) / 1.35, 0, 1));
                vCap = Math.min(vCap, Math.sqrt(vTurn * vTurn + 2 * 2.6 * Math.max(0, D)));
            }
            const ns = (v.tram ? (nxt.e.rail ? Math.min(11, edgeSpeed(nxt.e)) : 11) : edgeSpeed(nxt.e) * v.desiredMul);
            if (ns < desired) vCap = Math.min(vCap, Math.sqrt(ns * ns + 2 * 2 * Math.max(0, D)));
            prevNode = node; prevD = D;
            // A future shape leg uses the lane it will actually inherit at the
            // handoff, not the index on this vehicle's current wider road.
            curLane = this.laneOnNext(v, curLane, nxt.e, nxt.dir);
            curLaneCur = clamp(curLaneCur, 0, (lanesDir(nxt.e, nxt.dir) || 1) - 1);
            D += nxt.e.len; curE = nxt.e; curDir = nxt.dir;
        }
        // trams: stops every few hundred metres
        if (v.tram && !e.rail) {
            let d = v.nextStopOdo - v.odo;
            if (d > 0.8 && d < 60) {
                // the stop must hold the whole tram off the junction pads (never dwelling across a junction mouth)
                let ss = v.s + d, ce = e, cd = v.dir; if (ss > L && v.route[0] && !v.route[0].uturn) { ss -= L; ce = v.route[0].e; cd = v.route[0].dir; }
                const sp = ss <= ce.len ? this.sSpan(ce, cd, v.length, true) : [0, 0];
                if (!sp || ss < sp[0] || ss > sp[1]) { v.nextStopOdo += 12; d += 12; }
            }
            if (d < 60) {
                if (d < 0.8 && v.speed < 0.5) { v.dwell += dt; if (v.dwell > 5) { v.dwell = 0; v.nextStopOdo = v.odo + this.rng.range(300, 480); } else stopD = Math.min(stopD, 0); }
                else stopD = Math.min(stopD, Math.max(0, d));
            }
        }

        // ---------------- speed control ----------------
        const headway = this.buc ? 0.6 : 1.0, minGap = leader === P ? 2.2 : (this.buc ? 1.6 : 2.4), b = 4.5;
        let target = Math.min(desired, vCap);
        if (gap < Infinity) target = Math.min(target, Math.sqrt(Math.max(0, leaderSpeed * leaderSpeed + 2 * b * (gap - minGap - v.speed * headway))));
        if (stopD < Infinity) target = Math.min(target, Math.sqrt(Math.max(0, 2 * b * (stopD - 0.3))));
        if (leader === P && gap < 0.6) target = 0;
        if (v.jamHold > 0) target = 0;
        if (v.yieldT > 0) { v.yieldT -= dt; const o = v.yieldTo; if (!o || o.inactive || o.parked || Math.hypot(o.x - v.x, o.z - v.z) > v.length / 2 + o.length / 2 + 3) { v.yieldT = 0; v.yieldTo = null; } else target = 0; }
        const accel = v.tram ? 1.2 : v.bus || v.kind === 'truck' ? 1.6 : (this.buc ? 3.0 : 2.4);
        if (target > v.speed) v.speed = Math.min(target, v.speed + accel * dt);
        else v.speed = Math.max(target, v.speed - (leader === P && gap < 3 ? 14 : 8.5) * dt);
        // At 30Hz a tram's first 1.2m/s² step is .04m/s. Do not erase
        // that positive acceleration on every source-rail tick from rest.
        if (v.speed < 0.05 && (!e.rail || target < 0.05)) v.speed = 0;
        v.gap = gap; v.leader = leader; v.leaderCross = leaderCross; v.stopD = stopD; v.stopWhy = stopWhy;

        // ---------------- stuck / honking ----------------
        // waiting in a red-light queue is not "stuck"
        const sharedWait = stopWhy === 'shared-lane';
        const redQ = waitingRed || sharedWait || (leader && typeof leader === 'object' && leader !== P && (leader.waitRed || leader.redQ) && gap < 12);
        v.waitRed = waitingRed; v.redQ = !!redQ;
        if (v.speed < 0.3 && desired > 1 && v.dwell === 0) {
            v.stuck += dt;
            if (!redQ) v.still += dt; else v.still = 0; // (a jam's stop-and-go holds last ≤ 6 s: 18 s still is a real gridlock)
            v.honkCd -= dt * (1 + jam);
            if (v.stuck > v.honkAt * (1 - 0.6 * jam) && v.honkCd <= 0 && !waitingRed) {
                v.honkCd = this.rng.range(4, 14) / (0.2 + this.chaos);
                if (this.rng.chance(0.15 + this.chaos * 0.7 + jam * 0.2)) this.honk(v, 'stuck');
            }
            // face to face / T-boned with a stopped player at a merge for 8 s: both wait for each other — move the NPC
            // back along its lane (nudge) so the player's way is free
            if (leader === P && P && (P.stillT || 0) > 8 && v.stuck > 8) { v.stuck = 0; this.nudge(v); return; }
            if (!waitingRed && !sharedWait && leader !== P && leader !== 'ped') {
                const dP = P ? Math.hypot(P.x - v.x, P.z - v.z) : 1e9;
                if (v.stuck > 12 && dP > 150) { this.respawn(v); return; }
            }
        } else { v.stuck = 0; v.still = 0; }

        // ---------------- bypass double-parked cars / a stopped player ----------------
        const lanes = lanesDir(e, v.dir);
        if (!v.bypass && !v.tram && leader && typeof leader === 'object' && v.speed < 3 && gap < 12 && !inJunction &&
            (leader.parked || (leader === P && v.blockT > 2.0))) {
            const isP = leader === P;
            if (v.lane > 0 && this.laneFree(v, v.lane - 1)) { v.lane--; v.laneChangeCd = 3; }
            else if (isP && v.lane < lanes - 1 && this.laneFree(v, v.lane + 1)) { v.lane++; v.laneChangeCd = 3; }
            else if (lanes === 1 || v.stuck > 1.5) this.tryBypass(v, leader, isP);
        }
        if (v.bypass) {
            v.bypassT -= dt;
            const o = v.bypass, isP = o === P;
            const of = isP ? playerExtent(P, fx, fz) : o.length * 0.5;
            const f = (o.x - v.x) * fx + (o.z - v.z) * fz;
            const passed = f < -(of + half + 1);
            const beside = !passed && f < of + half + 1.5;
            const gone = isP ? Math.hypot(P.x - v.x, P.z - v.z) > 40 : (o.edge !== v.edge && f < 0);
            if (passed || gone || (v.bypassT <= 0 && !beside)) { v.bypass = null; v.lateralExtra = 0; }
        }

        // ---------------- lane changes (rare, only when useful) ----------------
        v.laneChangeCd -= dt;
        if (!v.tram && lanes > 1 && v.laneChangeCd <= 0 && !v.bypass && !inJunction) {
            const blocked = leader && leader !== 'ped' && gap < 25 && leaderSpeed < desired * 0.6;
            const wander = this.buc && v.speed > 6 && this.rng.chance(0.0006 * this.chaos);
            let want = blocked || (v.stuck > 2 && gap < 8) || wander;
            const busLane = Math.min(lanes - 1, laneDropMax);
            if (v.bus && v.lane !== busLane) want = true;
            if (want) {
                let options = v.bus ? [busLane > v.lane ? v.lane + 1 : v.lane - 1] : [v.lane - 1, v.lane + 1];
                const lmax = Math.min(laneDropMax, v.bus ? lanes - 1 : this.carLaneMax(v.edge, v.dir, v));
                options = options.filter(l => l >= 0 && l <= lmax && l !== v.lane);
                if (this.rng() < 0.5) options.reverse();
                let done = false;
                for (const l of options) {
                    if (this.laneFree(v, l)) { v.lane = l; v.laneChangeCd = this.rng.range(this.buc ? 4 : 6, this.buc ? 9 : 14); done = true; if (this.chaos > 0.5 && this.rng.chance(0.2)) this.honk(v, 'lanechange'); break; }
                }
                if (!done) v.laneChangeCd = this.buc ? 0.8 : 1.5;
            }
        }
        this.steerLane(v, dt);
        if (!this.turnLaneAllows(v.edge, v.dir, v.lane, v.route[0], v)) this.ensureRoute(v);

        // ---------------- move ----------------
        v.s += v.speed * dt; v.odo += v.speed * dt;
        if (v.transition > 0) v.transition -= dt;
        let guard = 0;
        while (v.s >= v.edge.len && guard++ < 8) { this.advance(v); this.ensureRoute(v); }
        v.annoyed = Math.max(0, v.annoyed - dt);
        v.bubbleCd -= dt;
        this.placeOnLane(v, false, dt);
        if (v.edge.rail && (!this.railBodyInside(v) || !initialTrafficStaticClearance(this.world, v).valid)) {
            this.revert(v); v.speed = 0; v.zeroWhy = 'rail-source-domain-or-static';
            this.stats.railSourceBlocked = (this.stats.railSourceBlocked || 0) + 1;
        }
        if (v._pp0 !== undefined) {
            const pen = vpPen(v, P);
            // this step would push into the player (box as drawn): undo it, whatever edge it reached, and wait
            // (only when the player is ahead: a turning NPC's rear swings toward a player tailgating behind it, and
            //  reverting that froze the NPC — and the player behind it — for good; it is driving away from the player)
            const aheadP = (P.x - v.x) * -Math.sin(v.heading) + (P.z - v.z) * -Math.cos(v.heading) > 0;
            if (aheadP && pen > -0.05 && pen > v._pp0 + 0.002) {
                if (v.stuck > 6 && pen > 0) { this.revert(v); this.nudge(v); } // pinned against the player for good (a merge): move it out
                else { this.revert(v); v.speed = 0; v.zeroWhy = 'revP'; }
            }
        }
        if (v.latBlend && v.s > 12) v.latBlend = 0;
    }

    /** Steering needs forward travel: a pending lane/bypass never slides a stopped car.
     * Both offsets share the same lateral-distance budget (also for long bodies). */
    steerLane(v, dt) {
        const travel = v.speed * dt, steerDt = dt * clamp(v.speed / 3, 0, 1);
        const lane = (v.lane - v.laneCur) * (1 - Math.exp(-2.2 * steerDt));
        const extra = (v.lateralExtra - v.latExtraCur) * (1 - Math.exp(-2 * steerDt));
        const lateral = Math.abs(lane * (v.edge.laneW ?? 3.3)) + Math.abs(extra);
        const scale = lateral > 0 ? Math.min(1, 0.45 * travel / lateral) : 0;
        v.laneCur += lane * scale; v.latExtraCur += extra * scale;
    }

    /** Plan across literal short source segments, so a long body starts its
     * merge before the last metre of a lane exists. No graph record is joined. */
    laneDropMax(v, look) {
        let maxLane = Math.max(0, lanesDir(v.edge, v.dir) - 1), distance = v.edge.len - v.s - v.length / 2;
        let e = v.edge, dir = v.dir;
        for (const next of v.route) {
            if (distance >= look || next.uturn || this.keepsTurnLane(e, dir, next)) break;
            maxLane = Math.min(maxLane, Math.max(0, lanesDir(next.e, next.dir) - 1));
            distance += next.e.len; e = next.e; dir = next.dir;
        }
        return maxLane;
    }
    /** Once its body has passed the stop line it must clear the intersection;
     * travel supplies the remaining smooth lateral merge, never a stopped slide. */
    laneDropStop(v, nextLanes, distance, radius, laneCur = v.laneCur) {
        const stop = distance - radius - 1.5;
        return laneCur > nextLanes - 1 + 0.25 && distance - radius < 6 && stop > -0.5 ? stop : Infinity;
    }

    /** path across the junction pad for v going (curE,curDir) → nxt: entry lane point → exit lane point */
    boxPath(v, curE, curDir, nxt, rad) {
        if (curE.rail) {
            const sIn = Math.max(0, curE.len - rad), sOut = Math.min(nxt.e.len, rad), index = v.route.findIndex(r => r.e === nxt.e && r.dir === nxt.dir);
            const virtual = { ...v, edge: curE, dir: curDir, s: sIn, route: index < 0 ? [nxt] : v.route.slice(index) };
            const segments = tramPathPolyline(virtual, -v.length / 2, curE.len - sIn + sOut + v.length / 2);
            if (!segments?.length) throw new Error('Unresolved source rail reservation ' + v.id);
            return { ...segments[0], p1x: segments.at(-1).p1x, p1z: segments.at(-1).p1z, inE: curE, outE: nxt.e, outDir: nxt.dir, lane: 0, laneIn: 0, railSegments: segments };
        }
        const laneIn = this.routeLaneAt(v, curE, curDir), lane = this.laneOnNext(v, laneIn, nxt.e, nxt.dir);
        const latIn = v.tram ? tramOffset(curE, curDir) : laneOffset(curE, laneIn, curDir), latOut = v.tram ? tramOffset(nxt.e, nxt.dir) : laneOffset(nxt.e, lane, nxt.dir);
        const sIn = Math.max(0, curE.len - rad), sOut = Math.min(nxt.e.len, rad);
        const st = curDir > 0 ? curE.a : curE.b, fx = curE.dirx * curDir, fz = curE.dirz * curDir;
        const st2 = nxt.dir > 0 ? nxt.e.a : nxt.e.b, gx = nxt.e.dirx * nxt.dir, gz = nxt.e.dirz * nxt.dir;
        // the body extends half a length beyond both ends of the chord
        const p0x = st.x + fx * sIn + curE.nx * curDir * latIn - fx * v.length * 0.5, p0z = st.z + fz * sIn + curE.nz * curDir * latIn - fz * v.length * 0.5;
        const p1x = st2.x + gx * sOut + nxt.e.nx * nxt.dir * latOut + gx * v.length * 0.5, p1z = st2.z + gz * sOut + nxt.e.nz * nxt.dir * latOut + gz * v.length * 0.5;
        return { p0x, p0z, p1x, p1z, inE: curE, outE: nxt.e, outDir: nxt.dir, lane, laneIn };
    }
    /** 'wait' when the path conflicts with a reservation of another car still in / entering the box, else the path */
    boxCheck(v, curE, curDir, nxt, node, rad) {
        const path = this.reservationPath(v, curE, curDir, nxt, node, rad);
        const key = this.boxController(node);
        const list = this.boxes.get(key); if (!list) return path;
        // first come, first served: only claims older than ours count (no two cars ever wait for each other)
        let mine = Infinity; for (const r of list) if (r.v === v) mine = r.t0;
        for (const r of list) {
            const o = r.v; if (o === v || o.inactive || r.t0 >= mine || !this.inBox(r, key)) continue;
            if (r.inE === curE && r.laneIn === v.lane) continue; // ahead of us in our lane: plain car-following
            for (const a of path.segments) for (const b of r.segments) {
                const gap = segDist(a.p0x, a.p0z, a.p1x, a.p1z, b.p0x, b.p0z, b.p1x, b.p1z);
                if (gap < (v.width + o.width) * 0.5 + 0.5) return 'wait';
            }
        }
        return path;
    }
    boxClaim(v, node, path) {
        const key = this.boxController(node);
        let list = this.boxes.get(key); if (!list) this.boxes.set(key, list = []);
        if (!path.segments) path = this.reservationPath(v, v.edge, v.dir, v.route[0], node, node.radius ?? 6);
        for (const r of list) if (r.v === v) { if (!r.entered) { const t0 = r.t0; Object.assign(r, path); r.t0 = t0; } r.t = this.time; return; }
        path.v = v; path.t = this.time; path.t0 = this.time; list.push(path);
    }
    /** Reserve every pad and connecting lane through this controller, including turns. */
    reservationPath(v, curE, curDir, nxt, node, rad) {
        const path = this.boxPath(v, curE, curDir, nxt, rad);
        path.segments = path.railSegments || [{ ...path }]; path.internalEdges = new Set(); path.entryRad = rad; path.exitRad = rad;
        path.phase = node.sourceSignal?.phase ?? this.world.nodeLight?.[node.id]?.approaches.find(a => a.edge === curE)?.phase;
        const cl = node.lightCluster;
        let step = nxt, i = 0, exitIndex = 0;
        while (cl && step && i < v.route.length) {
            const end = step.dir > 0 ? step.e.b : step.e.a, after = v.route[++i];
            if (end.lightCluster !== cl || !after || after.uturn) break;
            path.internalEdges.add(step.e);
            const segment = this.boxPath(v, step.e, step.dir, after, end.radius ?? 6), last = path.segments[path.segments.length - 1];
            path.segments.push({ p0x: last.p1x, p0z: last.p1z, p1x: segment.p0x, p1z: segment.p0z }, segment);
            path.outE = after.e; path.outDir = after.dir; path.exitRad = end.radius ?? 6; step = after; exitIndex = i;
        }
        path.generation = v._moveGeneration || 0;
        path.clearEdges = new Set(v.route.slice(exitIndex).map(r => r.e));
        path.clearOdo = (v.odo || 0) + curE.len - v.s + v.route.slice(0, exitIndex).reduce((d, r) => d + r.e.len, 0) + path.exitRad + v.length * 0.5 + 1;
        return path;
    }
    /** a reservation holds until the car's rear has left the pad (or it went elsewhere / timed out) */
    inBox(r, node) {
        const o = r.v;
        if (o.inactive || (o._moveGeneration || 0) !== r.generation || o.odo >= r.clearOdo) return false;
        if (o.edge === r.inE) {
            if (o.s + o.length * 0.5 > o.edge.len - r.entryRad - 0.8) r.entered = true;
            return r.entered || this.time - r.t0 < 6 || o.speed > 0.5;
        }
        if (r.internalEdges.has(o.edge)) { r.entered = true; return true; }
        if (o.edge === r.outE) { r.entered = true; return o.s - o.length * 0.5 < r.exitRad + 1; }
        // A short shape segment can end while a bus's rear still occupies the pad.
        if (r.entered && r.clearEdges.has(o.edge) && o.odo < r.clearOdo) return true;
        return false;
    }
    syncSignalOccupancy() {
        for (const l of this.world.lights || []) l.node.lightCluster.occupiedPhases = [];
        for (const [key, list] of this.boxes) for (const r of list) {
            if (this.inBox(r, key) && r.entered && Number.isInteger(r.phase) && key.occupiedPhases && !key.occupiedPhases.includes(r.phase)) key.occupiedPhases.push(r.phase);
        }
    }
    pruneBoxes() {
        for (const [node, list] of this.boxes) {
            for (let i = list.length - 1; i >= 0; i--) if (!this.inBox(list[i], node)) list.splice(i, 1);
            if (!list.length) this.boxes.delete(node);
        }
    }
    /** undo this frame's step of v (incl. edge changes); false when it cannot (respawned / not stepped) */
    revert(v) {
        if (v._f !== this._frame || v._resp) return false;
        const x = v.x, z = v.z;
        if (v._sh && v._sh.length) { while (v._sh.length) v.route.unshift(v._sh.pop()); }
        if (v.hist && v.hist.length > v._hl0) v.hist.length = v._hl0;
        v.edge = v._e0; v.dir = v._d0; v.lane = v._ln0; v.layer = v._ly0; v.y = v._y0; v.latBlend = v._lb0;
        if (v._railHist0 && v.edge.rail) v.hist = v._railHist0.slice();
        v.s = v._s0; v.odo = v._odo0; v.x = v._x0; v.z = v._z0; v.heading = v._h0; v.laneCur = v._lc0; v.latExtraCur = v._le0;
        v.fx = v._fx0; v.fz = v._fz0; v.rx = v._rx0; v.rz = v._rz0; v.transition = v._tr0;
        v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.y = v.heading;
        this.refreshVehicleCell(v, x, z);
        return true;
    }

    /** Later guards must still find a body that a correction moved across a hash boundary. */
    refreshVehicleCell(v, oldX, oldZ) {
        const c = this.grid.cell;
        if (c && (Math.floor(v.x / c) !== Math.floor(oldX / c) || Math.floor(v.z / c) !== Math.floor(oldZ / c))) this.grid.build(this.vehicles);
    }

    /** A recovery translation must actually separate the drawn bodies. The
     * source path alone cannot tell which way is outward at a short bend. */
    separateVehicleStep(v, other, distance) {
        if (v._separateFrame !== this._frame) { v._separateFrame = this._frame; v._separateLeft = 0.8 * (this._dt || 1 / 30); }
        distance = Math.sign(distance) * Math.min(Math.abs(distance), v._separateLeft);
        if (Math.abs(distance) < 1e-8) return false;
        const x = v.x - Math.sin(v.heading) * distance, z = v.z - Math.cos(v.heading) * distance;
        const before = vvPen(v, other), after = vvPen(v, other, x, z);
        const outward = Math.hypot(x - other.x, z - other.z) > Math.hypot(v.x - other.x, v.z - other.z) + 1e-6;
        if (!(after < before - 1e-6 || (after <= before + 1e-6 && outward))) return false;
        let clear = true;
        this.grid.query(x, z, v.length / 2 + 24, o => {
            if (!clear || o === v || o.inactive || Math.abs(o.y - v.y) > 2) return;
            const pen = vvPen(v, o, x, z);
            if (pen > 0 && pen > Math.max(0, vvPen(v, o)) + 1e-6) clear = false;
        });
        const P = this.player;
        if (clear && P && Math.abs((P.y ?? 0.24) - v.y) <= 2.5 &&
            vpPen({ ...v, x, z }, P) > Math.max(0, vpPen(v, P)) + 1e-6) clear = false;
        if (clear && streetLevel(v)) this.peds?.grid.query(x, z, v.length / 2 + 2, p => {
            if (pedestrianPen(v, p, x, z) > Math.max(0, pedestrianPen(v, p)) + 1e-6) clear = false;
        });
        if (!clear) return false;
        const oldX = v.x, oldZ = v.z;
        v.x = x; v.z = z; v.s += distance; v.odo += distance;
        v._separateLeft -= Math.abs(distance);
        v.mesh.position.set(v.x, v.y, v.z);
        this.refreshVehicleCell(v, oldX, oldZ);
        return true;
    }

    /**
     * Vehicles never drive into each other: a vehicle whose step this frame made it overlap another one more than
     * before takes the step back (same edge) and stops; the normal car-following then resolves the queue.
     */
    overlapGuard() {
        const f = this._frame, dt = this._dt || 1 / 30, P = this.player;
        // stepVehicle may cross a hash-cell boundary. The following checks
        // compare the proposed rendered bodies, so index those positions now.
        // Otherwise Grid.query rejects a moved body in its old bucket and the
        // other car can advance through it before that body's own rollback.
        this.grid.build?.(this.vehicles);
        const seen = this._ogSeen || (this._ogSeen = new Set()); seen.clear();
        for (const v of this.vehicles) {
            if (v.inactive) continue;
            const stepped = v._f === f && !v.parked && (v.x !== v._x0 || v.z !== v._z0 || v.heading !== v._h0);
            let worse = false, hit = null, hp = 0;
            const vl = v.length / 2;
            this.grid.query(v.x, v.z, vl + 9, (o) => {
                if (o === v || o.inactive || Math.abs(o.y - v.y) > 2) return;
                const p = vvPen(v, o); if (p <= 0.05) return;
                if (stepped) {
                    const p0 = vvPen(v, o, v._x0, v._z0, v._h0);
                    // Preserve the established normal-motion tolerances. The
                    // recovery translations below use their stricter contact
                    // checks; tiny enclosing-box corner contact must not turn
                    // ordinary junction travel into an indefinite wait.
                    const apart = p0 > 0.05 && p < p0 + 0.04 && Math.hypot(v.x - o.x, v.z - o.z) > Math.hypot(v._x0 - o.x, v._z0 - o.z) + 0.005;
                    if (p > p0 + 0.002 && !apart) worse = true;
                }
                if (p > hp) { hp = p; hit = o; }
            });
            // 1) this frame's step made it worse: take it back
            let reverted = false;
            if (worse && this.revert(v)) {
                v.speed = 0; v.zeroWhy = 'guard'; this.stats.guard = (this.stats.guard || 0) + 1;
                // A long wait cannot make another rendered body passable.
                v.revT = (v.revT || 0) + dt; reverted = true;
                v.knotHold = Math.max(v.knotHold || 0, KNOT_HOLD_S); // a refused step is a contact too: bodies touching below the overlap threshold
                // The restored pose can itself be an established contact (a nose in a crossing car's side). Every
                // later step is refused the same way, so that contact still needs the bounded back-off below:
                // skipping it left visible knots frozen for minutes, with the whole queue behind them.
                hit = null; hp = 0;
                this.grid.query(v.x, v.z, vl + 9, (o) => {
                    if (o === v || o.inactive || Math.abs(o.y - v.y) > 2) return;
                    const p = vvPen(v, o); if (p > 0.05 && p > hp) { hp = p; hit = o; }
                });
            }
            if (!reverted && v.revT) v.revT = Math.max(0, v.revT - dt * 0.5);
            let opening = false;
            if (!hit) {
                // an opened contact is widened to a small real gap before ordinary driving resumes
                let near = null, gap = Infinity;
                if (v.knotHold > 0 || v.yieldT > 0) this.grid.query(v.x, v.z, vl + 9, (o) => {
                    if (o === v || o.inactive || o.parked || Math.abs(o.y - v.y) > 2) return;
                    const yielding = (v.yieldT > 0 && v.yieldTo === o) || (o.yieldT > 0 && o.yieldTo === v);
                    const c = -vvClearance(v, o); if (c < (yielding ? KNOT_YIELD_GAP : KNOT_OPEN_GAP) && c < gap) { gap = c; near = o; }
                });
                if (!near) { v.ovT = 0; v.knotHold = 0; continue; }
                v.knotHold -= dt; hit = near; hp = -gap; opening = true;
            } else v.knotHold = KNOT_HOLD_S;
            // 2) already overlapping: the follower (the one with the other ahead of it) backs off along its path
            const k = v.id < hit.id ? v.id + ':' + hit.id : hit.id + ':' + v.id; if (seen.has(k)) continue; seen.add(k);
            const contacts=this._contactDialogue||(this._contactDialogue=new Map());
            if(!opening&&this._situational&&this.time-(contacts.get(k)??-Infinity)>8){contacts.set(k,this.time);while(contacts.size>128)contacts.delete(contacts.keys().next().value);const event=this.dialogueEvent('collision',v,{sourceRole:'driver',target:hit,targetRole:'driver',facts:{contact:true,collisionType:'vehicle',playerCausedContact:false}});this.speakSituational(event,hit,'driver');this.emitDialogueEvent(event,{participant:v});}
            const ahead = (a, b) => (b.x - a.x) * -Math.sin(a.heading) + (b.z - a.z) * -Math.cos(a.heading);
            let fol = ahead(v, hit) >= ahead(hit, v) ? v : hit;
            // (a crossing contact: the car whose nose is in the other's side reverses; sliding the struck car along that
            // nose keeps the same contact and only looked like a separation)
            let crossing = false;
            { const vn = noseInto(v, hit), hn = noseInto(hit, v);
                if (vn !== hn) fol = vn ? v : hit;
                // converging noses have no follower either: one of them keeps yielding (the same one, once chosen)
                else if (vn && Math.abs(Math.sin(v.heading - hit.heading)) > .35) fol = v.yieldT > 0 && v.yieldTo === hit ? v : hit.yieldT > 0 && hit.yieldTo === v ? hit : v.id > hit.id ? v : hit;
                crossing = (vn || hn) && Math.abs(Math.sin(v.heading - hit.heading)) > .35; }
            if (fol.parked || fol.tram) fol = fol === v ? hit : v;
            if (fol.parked) {
                // two parked cars inside each other (placed / respawned onto one another): move one away, out of view
                if (!fol.service && (fol === v ? hit : v).parked && P) { const dx = fol.x - P.x, dz = fol.z - P.z, d = Math.hypot(dx, dz); if (d > 70 || (d > 30 && dx * P.fx + dz * P.fz < 0)) { this.respawn(fol); this.stats.unstuck = (this.stats.unstuck || 0) + 1; } }
                continue;
            }
            const other = fol === v ? hit : v;
            fol.speed = 0; fol.zeroWhy = (opening ? 'ovOpen:' : 'ovFol:') + (other.kind || '') + '#' + other.id; if (!opening) fol.ovT = (fol.ovT || 0) + dt;
            const yields = (a, b) => { if (!crossing || a.tram) return; a.yieldTo = b; a.yieldT = KNOT_YIELD_S; if (b.yieldTo === a) b.yieldT = 0; };
            const back = Math.min(hp + (opening ? (crossing ? KNOT_YIELD_GAP : KNOT_OPEN_GAP) : 0.05), 0.8 * dt);
            let separated = false;
            const canBack = (a) => a.s - back > 0.3 && !a.tram && !a.parked && !(P && Math.hypot(P.x - a.x, P.z - a.z) < 12 && vpPen(a, P) > -0.4 && (P.x - a.x) * -Math.sin(a.heading) + (P.z - a.z) * -Math.cos(a.heading) < 0);
            if (canBack(fol)) {
                separated = this.separateVehicleStep(fol, other, -back);
                if (separated) { this.stats.separate = (this.stats.separate || 0) + 1; yields(fol, other); }
            }
            // A T-bone has no follower along one path: the car whose nose is in the other's side is the one whose
            // own reversing opens the contact, whichever of the two the path order names.
            if (!separated && canBack(other) && this.separateVehicleStep(other, fol, -back)) {
                separated = true; other.speed = 0; other.zeroWhy = (opening ? 'ovOpen:' : 'ovFol:') + (fol.kind || '') + '#' + fol.id;
                yields(other, fol);
                this.stats.separate = (this.stats.separate || 0) + 1; this.stats.separateCross = (this.stats.separateCross || 0) + 1;
            }
            if (opening) continue;
            if (!separated && other.speed < 0.3 && !other.parked && !other.tram && other.s + 0.25 < other.edge.len - 0.5 && !(P && vpPen(other, P) > -0.3)) {
                // the follower cannot back up (start of its edge): nudge the one in front forward instead
                this.separateVehicleStep(other, fol, Math.min(0.25, 0.8 * dt));
            }
            // 3) stuck together for a while and out of the player's sight: move the follower elsewhere
            if (fol.ovT > 0.4) {
                let hidden = true;
                if (P) { const dx = fol.x - P.x, dz = fol.z - P.z, d = Math.hypot(dx, dz); hidden = d > 70 || (d > 30 && dx * P.fx + dz * P.fz < 0); } // (a swap 70 m away goes unnoticed; two cars stuck in each other would not)
                if (hidden) { fol.ovT = 0; if (!(this.large && this.relocate(fol, 250, this.bubble, true))) this.respawn(fol); this.stats.unstuck = (this.stats.unstuck || 0) + 1; }
                // Visible knots keep their physical pose and bounded separating
                // steps. A timeout never enables penetration or a visible swap.
            }
        }
        // 4) nothing may end the frame inside the player's car: slide such an NPC out along its own axis
        if (P) for (const v of this.near(P.x, P.z, 14)) {
            if (v.parked || v.tram || Math.abs((P.y ?? 0.24) - v.y) > 2.5) continue;
            const pen = vpPen(v, P); if (pen <= 0.05) continue;
            const hx = -Math.sin(v.heading), hz = -Math.cos(v.heading);
            const sg = (v.x - P.x) * hx + (v.z - P.z) * hz >= 0 ? 1 : -1, d = Math.min(pen + 0.05, 0.5) * sg;
            if (v.s + d < 0.2 || v.s + d > v.edge.len - 0.2) continue;
            const oldX = v.x, oldZ = v.z;
            v.s += d; v.odo += d; v.x += hx * d; v.z += hz * d; v.speed = 0; v.mesh.position.set(v.x, v.y, v.z);
            this.refreshVehicleCell(v, oldX, oldZ);
        }
    }

    /** The drawn body may sweep over a sidewalk in a turn. Yield to every
     * pedestrian there as well as crossing people, before a sideways push is needed. */
    pedestrianGuard() {
        for (const v of this.vehicles) {
            if (v.parked || v.inactive || v._f !== this._frame || v._resp || !streetLevel(v)) continue;
            if (v.x === v._x0 && v.z === v._z0 && v.heading === v._h0) continue;
            let worse = false;
            this.peds.grid.query(v.x, v.z, v.length / 2 + 2, p => {
                const pen = pedestrianPen(v, p);
                if (pen > 0.01 && pen > pedestrianPen(v, p, v._x0, v._z0, v._h0) + 0.002) worse = true;
            });
            if (worse && this.revert(v)) { v.speed = 0; v.zeroWhy = 'pedGuard'; this.stats.pedGuard = (this.stats.pedGuard || 0) + 1; }
        }
    }

    /** squeeze past a double-parked car or a stopped player (left if possible, else right), checking oncoming traffic */
    tryBypass(v, o, isP) {
        const e = v.edge, P = this.player;
        if (e.sharedLane) return false;
        const rx = v.rx, rz = v.rz;
        const curOff = laneOffset(e, v.laneCur, v.dir) + v.latExtraCur;
        const right = roadSideWidth(e, v.dir), left = roadSideWidth(e, -v.dir);
        const margin = 0.6;
        let shifts;
        if (isP) {
            const l = (P.x - v.x) * rx + (P.z - v.z) * rz, el = playerExtent(P, rx, rz);
            shifts = [l - el - v.width / 2 - margin, l + el + v.width / 2 + margin];
        } else shifts = [-(e.laneW ?? 3.3) * 0.95];
        let best = null;
        for (const sh of shifts) {
            const off = curOff + sh; // lateral offset from the centreline (right of travel = +)
            if (off + v.width / 2 > right + 0.3 || off - v.width / 2 < -left - 0.3) continue; // stay on the carriageway
            if (Math.abs(sh) > (e.laneW ?? 3.3) * 1.5) continue;
            const contra = !e.oneway && off - v.width / 2 < v.dir * (e.laneCenterShiftM || 0) + medianOf(e) / 2 - 0.2;
            if (contra && !this.oncomingClear(v, off, 45)) continue;
            if (!best || Math.abs(sh) < Math.abs(best)) best = sh;
        }
        if (best === null) return false;
        v.bypass = o; v.bypassT = isP ? 12 : 7; v.lateralExtra = v.latExtraCur + best;
        if (this.chaos > 0.5 && this.rng.chance(0.3)) this.honk(v, 'lanechange');
        return true;
    }
    /** no oncoming vehicle within `dist` ahead around lateral offset `off` */
    oncomingClear(v, off, dist) {
        const e = v.edge; const curOff = laneOffset(e, v.laneCur, v.dir) + v.latExtraCur;
        const cx = v.x + v.fx * dist * 0.5 + v.rx * (off - curOff), cz = v.z + v.fz * dist * 0.5 + v.rz * (off - curOff);
        let ok = true;
        this.grid.query(cx, cz, dist * 0.5 + 4, (o) => {
            if (!ok || o === v || o.parked || o.layer !== v.layer) return;
            if (o.fx * v.fx + o.fz * v.fz > -0.3) return;
            const dx = o.x - v.x, dz = o.z - v.z; const f = dx * v.fx + dz * v.fz, l = dx * v.rx + dz * v.rz;
            if (f > -4 && f < dist && Math.abs(l - (off - curOff)) < (v.width + o.width) * 0.5 + 0.8) ok = false;
        });
        return ok;
    }
    /** true when v overlaps another vehicle */
    overlapsAny(v) {
        let hit = false;
        this.grid.query(v.x, v.z, 12, (o) => {
            if (hit || o === v || o.layer !== v.layer) return;
            const dx = o.x - v.x, dz = o.z - v.z; const f = dx * v.fx + dz * v.fz, l = dx * v.rx + dz * v.rz;
            if (Math.abs(f) < (v.length + o.length) * 0.5 + 0.3 && Math.abs(l) < (v.width + o.width) * 0.5 + 0.1) hit = true;
        });
        return hit;
    }
    /** a vehicle has been touching the player for a while: back it off a few metres, or move it out of view */
    nudge(v) {
        if (v.edge.rail) return this.nudgeRail(v);
        const P = this.player;
        if (this.inView(v)) {
            // In view, only separate actual player contact, along the body's axis
            // at a bounded pace. A blocked queue never gets a 3.5 m snap or respawn.
            const pen = vpPen(v, P); if (pen < -0.15) return;
            const hx = -Math.sin(v.heading), hz = -Math.cos(v.heading);
            const sign = (v.x - P.x) * hx + (v.z - P.z) * hz >= 0 ? 1 : -1;
            const d = Math.min(pen + 0.2, 0.8 * (this._dt || 1 / 30)) * sign;
            if (v.s + d <= 0.3 || v.s + d >= v.edge.len - 0.3) return;
            const x = v.x, z = v.z; v.x += hx * d; v.z += hz * d;
            if (vpPen(v, P) >= pen || this.overlapsAny(v)) { v.x = x; v.z = z; return; }
            v.s += d; v.odo += d; v.speed = 0; v.touchT = 3.01;
            v.mesh.position.set(v.x, v.y, v.z); return;
        }
        const f = (P.x - v.x) * v.fx + (P.z - v.z) * v.fz;
        v.nudges = (v.nudges || 0) + 1; v.touchT = 1.0;
        const ns = v.s + (f > 0 ? -3.5 : 3.5);
        if (v.nudges <= 2 && ns > 1 && ns < v.edge.len - 1) {
            const old = v.s; v.s = ns; this.placeOnLane(v, true, 0);
            if (!this.overlapsAny(v) && vpPen(v, P) < -0.2) { v.speed = 0; return; }
            v.s = old; this.placeOnLane(v, true, 0);
        }
        v.nudges = 0;
        if (!(this.large && this.relocate(v, 250, this.bubble, true))) this.respawn(v);
    }
    /** A recovery on rails still samples the source path; it cannot translate
     * along a turning body's chord and leave the track. Existing pace and
     * visibility limits remain, and every accepted pose must separate. */
    nudgeRail(v) {
        const P = this.player; if (!P) return;
        const visible = this.inView(v), beforePen = vpPen(v, P);
        if (visible && beforePen < -.15) return;
        const hx = -Math.sin(v.heading), hz = -Math.cos(v.heading), forward = (P.x - v.x) * hx + (P.z - v.z) * hz;
        const sign = forward > 0 ? -1 : 1, distance = visible ? Math.min(beforePen + .2, .8 * (this._dt || 1 / 30)) * sign : 3.5 * sign;
        const span = this.sSpan(v.edge, v.dir, v.length, true), s = v.s + distance;
        if (!span || s < span[0] || s > span[1]) { if (!visible) this.respawn(v); return; }
        const saved = this.savePose(v); v.s = s; this.placeOnLane(v, true, 0);
        if (vpPen(v, P) >= beforePen || this.overlapsAny(v) || !this.railBodyInside(v) || !initialTrafficStaticClearance(this.world, v).valid) { this.restorePose(v, saved); if (!visible) this.respawn(v); return; }
        v.odo += distance; v.speed = 0; v.touchT = 3.01;
        this.refreshVehicleCell(v, saved.x, saved.z);
    }
    /**
     * Player-blocked watchdog (round-5 QA, Bellevue finale): while the player drives and has crawled < 1 m/s for > 12 s,
     * NPCs ahead of it within ~32 m in (about) its lane, or knotted into each other in front of it, that have stood still
     * > 12 s without a red light to wait for are taken out and respawned elsewhere (relocated out of view on big maps).
     * Never in a forced jam (?jam) or inside an active Bucharest hotspot (rush hour must stay a jam), never parked / tram / service cars.
     */
    playerWatchdog(dt) {
        const P = this.player; if (!P || this.walker?.active) { if (P) P.blockedT = 0; return; }
        P.blockedT = Math.abs(P.speed || 0) < 1 ? (P.blockedT || 0) + dt : 0;
        if (P.blockedT < 12 || this.jamOverride != null || (this.buc && this.jamAt(P.x, P.z) > 0.3)) return; // (Bucharest rush-hour jams stay jams)
        this._wdT = (this._wdT || 0) + dt; if (this._wdT < 1) return; this._wdT = 0;
        let n = 0;
        for (const v of this.near(P.x, P.z, 34)) {
            if (v.parked || v.tram || v.service || v.inactive || v.speed > 0.3 || (v.stuck || 0) < 12 || v.waitRed || v.redQ) continue;
            if (this.inView(v)) continue;
            if (Math.abs((v.y ?? 0.24) - (P.y ?? P.surfY ?? 0.24)) > 2.5) continue;
            const dx = v.x - P.x, dz = v.z - P.z, f = dx * P.fx + dz * P.fz, l = Math.abs(dx * -P.fz + dz * P.fx);
            if (f < 0) continue;
            let knot = false;
            if (l > 4.5) { this.grid.query(v.x, v.z, v.length / 2 + 6, (o) => { if (!knot && o !== v && !o.inactive && Math.abs(o.y - v.y) < 2 && vvPen(v, o) > 0.05) knot = true; }); if (!knot) continue; }
            if (!(this.large && this.relocate(v, 250, this.bubble, true))) this.respawn(v);
            v.stuck = 0; v.still = 0; n++;
        }
        if (n) { this.stats.playerWatchdog = (this.stats.playerWatchdog || 0) + n; P.blockedT = 6; this.grid.build(this.vehicles); }
    }
    /** queues that have not moved for ~20 s: recycle the head vehicle (out of the player's view if possible) */
    resolveDeadlocks() {
        const P = this.player;
        for (const v of this.vehicles) {
            if (v.parked || v.still < 18) continue;
            let h = v; const seen = this._seen || (this._seen = new Set()); seen.clear(); seen.add(v);
            while (h.leader && typeof h.leader === 'object' && h.leader !== P && !h.leader.parked && !h.leader.inactive && h.leader.still > 2 && !seen.has(h.leader)) { h = h.leader; seen.add(h); }
            // A visible queue keeps its solid bodies and bounded physical
            // recovery. Waiting never blinds the cone or admits a visible swap.
            const inView = this.inView(h);
            if (h.dlTries && h.odo - (h.dlOdo ?? h.odo) > 15) h.dlTries = 0; // it got going since the last try
            if (h.inactive || inView) continue;
            if (!(this.large && this.relocate(h, 300, this.bubble, true)) && !this.respawn(h)) continue;
            h.still = 0; h.dlTries = 0; this.stats.deadlocks = (this.stats.deadlocks || 0) + 1;
            for (const s of seen) s.still = Math.min(s.still, 10);
        }
    }

    roundaboutBusy(node, v) {
        let busy = false;
        this.grid.query(node.x, node.z, (node.radius ?? 8) + 16, (o) => {
            if (busy || o === v || !o.edge.roundabout || o.speed < 0.5) return;
            const d = Math.hypot(o.x - node.x, o.z - node.z);
            if (d < (node.radius ?? 8) + 14) {
                // approaching the node (not leaving it)
                const toward = (node.x - o.x) * o.fx + (node.z - o.z) * o.fz;
                if (toward > -2) busy = true;
            }
        });
        return busy;
    }

    /** distance to the next un-served bus stop on (e,dir) given D = front-to-end distance for that edge */
    busStopAhead(v, e, dir, D, isCurrent) {
        const stops = this.busStops.get(e); if (!stops) return Infinity;
        let best = Infinity;
        for (const st of stops) {
            if (st.side !== dir && !e.oneway) continue;
            const sAlong = dir > 0 ? st.s : e.len - st.s; // in travel frame
            const d = D - (e.len - sAlong);
            if (v.served === st) continue;
            if (d < -1) continue;
            if (d < 1.2 && v.speed < 0.4) { // (also when the stop sits just past the next node)
                v.dwell += this._dt || 0.016;
                if (v.dwell > 4) { v.served = st; v.dwell = 0; continue; }
                return 0;
            }
            if (d < best) best = d;
        }
        return best;
    }

    laneFree(v, lane) {
        const lat = laneOffset(v.edge, lane, v.dir) + v.latExtraCur;
        const curLat = laneOffset(v.edge, v.laneCur, v.dir) + v.latExtraCur;
        const tx = v.x + v.rx * (lat - curLat), tz = v.z + v.rz * (lat - curLat);
        const front = this.buc ? 4 : 10, back = this.buc ? 2.5 : 8;
        let free = true;
        this.grid.query(tx, tz, 18, (o) => {
            if (!free || o === v || o.layer !== v.layer) return;
            if (o.fx * v.fx + o.fz * v.fz < 0.5 && !o.parked) return;
            const dx = o.x - tx, dz = o.z - tz;
            const f = dx * v.fx + dz * v.fz, l = dx * v.rx + dz * v.rz;
            if (Math.abs(l) > (v.width + o.width) * 0.5 + 0.2) return;
            const L2 = (v.length + o.length) * 0.5;
            if (f > -(L2 + back + Math.max(0, o.speed - v.speed) * 1.5) && f < L2 + front) free = false;
        });
        const P = this.player;
        if (free && P) {
            const dx = P.x - tx, dz = P.z - tz;
            if (Math.abs(dx) < 40 && Math.abs(dz) < 40) {
                const f = dx * v.fx + dz * v.fz, l = dx * v.rx + dz * v.rz;
                const ef = playerExtent(P, v.fx, v.fz), el = playerExtent(P, v.rx, v.rz);
                const closing = Math.max(0, v.speed - P.speed * (P.fx * v.fx + P.fz * v.fz));
                if (Math.abs(l) < v.width * 0.5 + el + 0.4 && f > -(v.length * 0.5 + ef + back + 1) && f < v.length * 0.5 + ef + front + 6 + closing * 1.5) free = false;
            }
        }
        return free;
    }

    honk(v, reason) {
        const dialogueEvent=this.onHonk(v, reason);
        const P = this.player;
        if (P && Math.hypot(P.x - v.x, P.z - v.z) < 70 && v.bubbleCd <= 0) {
            v.bubbleCd = 4;
            this.bubble(v, reason === 'stuck' ? 'stuck' : 'honkedAt',dialogueEvent);
        }
    }

    /** the player honked: nearby drivers react */
    playerHonk(px, pz, fx, fz,dialogueEvent=null) {
        let reacted = 0;
        for (const v of this.near(px, pz, 28)) {
            const dx = v.x - px, dz = v.z - pz;
            const d = Math.hypot(dx, dz);
            const ahead = (dx * fx + dz * fz) / (d || 1);
            if (ahead < -0.2 && d > 10) continue;
            if (v.parked && this.rng.chance(0.3)) { this.bubble(v, 'honkedAt',dialogueEvent); reacted++; continue; }
            v.annoyed = 6;
            if (v.bubbleCd <= 0 && this.rng.chance(this.chaos > 0.5 ? 0.6 : 0.3)) {
                v.bubbleCd = 3;
                this.bubble(v, 'honkedAt',dialogueEvent); reacted++;
                if (this.rng.chance(0.4 * this.chaos)) this._scheduleHornReply(v,300 + this.rng() * 800);
            }
            if (v.speed < 0.2 && !v.parked && this.rng.chance(0.25)) v.speed = 1.5;
        }
        this.peds.scare(px, pz, 20);
        // (round 6 note 49) the nearest pedestrians answer back — city-specific lines (data.js PHRASES.<city>.pedHonked)
        { const now = performance.now(); if (!(this._pedHonkT > now)) {
            const L = (PHRASES[this.city.id] || PHRASES.bucharest)?.pedHonked;
            const peds = (this.peds.near(px, pz, 18) || []).filter(p => p.state !== 'down').sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz));
            let said = 0;
            for (const p of peds) { if (said >= 2 || !L?.length) break; if (this.rng.chance(0.55)) continue;
                const it = L[Math.floor(this.rng() * L.length)], line = typeof it === 'string' ? { t: it } : it;
                if (this.say(p, line, 'mad', 1,{situational:true,event:dialogueEvent,role:'pedestrian',simulation:true})) { said++; reacted++; } }
            if (said) this._pedHonkT = now + 2500;
        } }
        return reacted;
    }

    /** player bumped vehicle v */
    bump(v,dialogueEvent=null) {
        if (v.bubbleCd <= 0) { v.bubbleCd = 4; this.bubble(v, 'bumped',dialogueEvent); }
        if (this.rng.chance(0.5 * this.chaos + 0.1)) this.honk(v, 'bumped');
    }

    _scheduleHornReply(v,delay) { const timer=setTimeout(()=>{this._replyTimers?.delete(timer);this.honk(v,'reply');},delay);(this._replyTimers||=new Set()).add(timer); }
    dialogueEvent(kind,source,options) { return this._situational?.event(kind,source,options)||null; }
    emitDialogueEvent(event,options) { return this._situational?.dispatch(event,options)||0; }
    speakSituational(event,actor,role,options) { return this._situational?.present(event,actor,role,options)||false; }
    situationalHudFrame() { this._situational?.hudFrame(); }

    /** nearby vehicles for collision tests */
    near(x, z, r) {
        const out = [];
        if (!this.grid.items) { for (const v of this.vehicles) { const dx = v.x - x, dz = v.z - z; if (dx * dx + dz * dz < r * r) out.push(v); } return out; }
        this.grid.query(x, z, r, (v) => { const dx = v.x - x, dz = v.z - z; if (dx * dx + dz * dz < r * r) out.push(v); });
        return out;
    }
    nearPeds(x, z, r) { return this.peds.near(x, z, r); }
    /** move every vehicle within r of (x,z) somewhere out of view (used by reset-to-road / fast travel). returns count */
    clearAround(x, z, r) {
        let n = 0;
        for (const v of this.vehicles) {
            if (Math.hypot(v.x - x, v.z - z) >= r + v.length * 0.5) continue;
            if (!(this.large && this.relocate(v, 250, this.bubble, true))) this.respawn(v, false);
            v.touchT = 0; n++;
        }
        this.grid.build(this.vehicles);
        return n;
    }
    /** a clean start for the player after a load / teleport / reset: nothing within r, nor in its lane from `behind` m
     *  back to `ahead` m in front (same level); returns how many vehicles were moved elsewhere */
    clearForPlayer(P = this.player, { r = 12, ahead = 40, behind = 12 } = {}) {
        if (!P) return 0;
        let n = 0;
        for (const v of this.vehicles) {
            if (Math.abs((v.y ?? 0.24) - (P.y ?? P.surfY ?? 0.24)) > 2.5) continue;
            const dx = v.x - P.x, dz = v.z - P.z, f = dx * P.fx + dz * P.fz, l = Math.abs(dx * -P.fz + dz * P.fx);
            const near = Math.hypot(dx, dz) < r + v.length * 0.5, inLane = l < 2.6 + v.width * 0.5 && f > -behind - v.length * 0.5 && f < ahead + v.length * 0.5;
            if (!near && !inLane) continue;
            if (!(this.large && this.relocate(v, 250, this.bubble, true))) this.respawn(v, false);
            v.touchT = 0; n++;
        }
        this.grid.build(this.vehicles);
        return n;
    }
    /** nearest police car within r (or null) */
    policeNear(x, z, r) { let best = null, bd = r; for (const p of this.police) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; }

    dispose() { try { this.endParking('dispose'); } catch { /* ignore */ } this._situational?.dispose();this._situational=null;for(const timer of this._replyTimers||[])clearTimeout(timer);this._replyTimers?.clear();this._bub=[];this.scene.remove(this.group); this.peds.dispose(); }

    // ------------------------------------------------------------------ illegal parking reactions (note 8)
    /**
     * The player's car left somewhere illegal while the player is on foot (traffic.walker active, car still): passers-by
     * notice it and react (tutting / remarks, photos, a call to the city, a note on the windscreen — RO / US lines),
     * blocked drivers queue, honk and go round it (routing avoids a single-lane street it blocks), and after a while
     * Poliția Locală (ticket, wheel clamp, the "ridicare auto" tow truck) or Parking Enforcement (ticket, tow truck) turn up.
     *   traffic.onParkingEvent(cb) → unsubscribe. Events { type, reason, reasons, severity ('obstruct' | 'mild'), city,
     *   district, x, z, t (s since parked), fine?: { amount, currency, label } }. Types: 'illegal' (detected when the car
     *   is left), 'noticed', 'photo', 'report' (called in), 'note' (US, windscreen note), 'officer' (on the way),
     *   'ticket', 'clamp' (RO), 'towtruck' (arrived), 'tow' (the car is to be taken away — gameplay decides what happens:
     *   impound / fine; nothing moves the car here), 'cleared' (the player drove off / the car moved).
     *   traffic.parking: live state { illegal, reasons, primary, severity, t, log } (null while driving).
     * Rules (approximate, per spec 13 Request to research): RO OUG 195/2002 — no stopping on crossings, in junctions,
     * in bus / tram stops, on tram tracks, in a traffic lane of a main road, in front of gates; sidewalk parking where not
     * marked is fined. US (WA RCW 46.61.570 / city codes) — no parking in a crosswalk or intersection, within 15 ft of a
     * hydrant, in a bus zone, on a sidewalk, blocking a driveway or a traffic lane.
     */
    onParkingEvent(cb) { const L = this._parkCbs || (this._parkCbs = []); L.push(cb); return () => { const i = L.indexOf(cb); if (i >= 0) L.splice(i, 1); }; }
    emitParking(type, extra = {}) {
        const st = this.park, c = st?.check || {};
        const ev = { type, city: this.city.id, district: this.world.district?.id || null, reason: c.primary || null, reasons: c.reasons || [], severity: c.severity || null, x: st?.x, z: st?.z, t: Math.round((st?.t || 0) * 10) / 10, ...extra };
        if (st) st.log.push(type + '@' + ev.t);
        this.stats.parkingEvents = (this.stats.parkingEvents || 0) + 1;
        for (const cb of (this._parkCbs || []).slice()) { try { cb(ev); } catch (e) { console.warn('[traffic] parking event handler', e); } }
        return ev;
    }
    /** a driver's chat bubble of a kind (honkedAt, bumped, stuck, green, redLight) from data.js PHRASES: Romanian lines
     *  are {t, en} and show the English gloss underneath (plain strings still work); falls back to opts.onBubble */
    bubble(v, kind,dialogueEvent=null) {
        const L = (PHRASES[this.city.id] || PHRASES.bucharest)?.[kind] || PHRASES.bucharest?.[kind];
        const canSay = !!(this.onSay || globalThis.game?.hud?.say);
        if (!L?.length || !canSay) { if(!this._situational)this.onBubble(v, kind); return; }
        const last = (this._lastLine || (this._lastLine = {}))[kind]; let k = Math.floor(Math.random() * L.length);
        if (L.length > 1 && k === last) k = (k + 1 + Math.floor(Math.random() * (L.length - 1))) % L.length; // (never the same line twice in a row)
        this._lastLine[kind] = k;
        const it = L[k], line = typeof it === 'string' ? { t: it } : it;
        this.say(v, line, kind === 'bumped' ? 'angry' : kind === 'honkedAt' ? 'mad' : '', kind === 'bumped' ? 2 : 1,{situational:true,event:dialogueEvent,role:'driver'});
    }
    /** a chat bubble over anything with {x, z}: opts.onSay(target, text, sub, cls) when gameplay wires it, else hud.say */
    say(target, line, cls = '', pri = 2,options=null) {
        if(this._situational&&!options?.actual&&!options?.legacyAdmission){
            const legacy=this._situational.legacyAdmission(target,line,cls,pri);
            const actual=options?.situational?this._situational.present(options.event,target,options.role):this.say(target,line,cls,pri,{actual:true});
            return options?.simulation?legacy:actual;
        }
        if (!line || !target) return false;
        const ref = this.walker?.active ? this.walker : this.player;
        if (ref && Math.hypot(target.x - ref.x, target.z - ref.z) > 75) return false;
        // (after round 6) someone on another level (under the bridge / on the deck above) isn't talking to us
        if (ref && Number.isFinite(ref.y) && Math.abs((Number.isFinite(target.y) ? target.y : 0) - ref.y) > 3.5) return false; // (pedestrians: street level)
        const text = line.t, sub = line.en && line.en !== line.t ? line.en : '';
        const tgt = this.placeBubble(target, pri, !!sub,options?.legacyAdmission); if (!tgt) return false;
        if(options?.legacyAdmission){const h=options.legacyAdmission.hud;h.bubbles.push({v:tgt,until:performance.now()+4200});if(h.bubbles.length>14)h.bubbles.shift();return true;}
        try { if (this.onSay) this.onSay(tgt, text, sub, cls); else if(globalThis.game?.hud?.say)globalThis.game.hud.say(tgt,text,sub,cls);else if(options?.actual)return false; } catch { if(options?.actual)return false; }
        this._situational?.markEmitted(tgt);
        this.stats.parkingBubbles = (this.stats.parkingBubbles || 0) + 1;
        (this._sayLog || (this._sayLog = [])).push(text); if (this._sayLog.length > 40) this._sayLog.shift();
        return true;
    }
    /**
     * Screen-space layout of the chat bubbles traffic shows: at most 3 at once; a new bubble that would cover another one
     * is nudged sideways (its anchor follows the speaker with a world offset along the camera's right axis — the HUD
     * re-projects the anchor every frame), and when no nudge is free the lower-priority bubble is dropped (driver
     * grumbles 1 < passers-by / bumps 2 < officer / tow 3). Returns the anchor to hand to hud.say, or null (dropped).
     */
    placeBubble(target, pri, two,layout=null) {
        const now = performance.now(), cam = globalThis.game?.camera, hud = layout?.hud||globalThis.game?.hud,state=layout||this;
        const act = (state._bub = (state._bub || []).filter(b => b.until > now && (!hud?.bubbles || hud.bubbles.some(h => h.v === b.anchor))));
        const W = globalThis.innerWidth || 1280, Hh = globalThis.innerHeight || 720;
        const V = state._bv || (state._bv = new THREE.Vector3());
        const scr = (x, z, y = 2.6) => { if (!cam) return null; V.set(x, y, z).project(cam); if (V.z > 1 || Math.abs(V.x) > 1.2 || Math.abs(V.y) > 1.2) return null; return [(V.x + 1) / 2 * W, (1 - V.y) / 2 * Hh]; };
        const drop = (b) => { b.until = 0; const h = hud?.bubbles?.find(q => q.v === b.anchor); if (h) h.until = 0; };
        // at most three: make room by dropping the lowest priority (never one that outranks the new bubble)
        if (act.length >= 3) { const lo = act.reduce((a, b) => (b.pri < a.pri ? b : a)); if (lo.pri > pri || (lo.pri === pri && pri < 3)) return null; drop(lo); }
        const live = act.filter(b => b.until > now);
        const p0 = scr(target.x, target.z, target.bubbleY ?? 2.6);
        let ox = 0, oz = 0;
        if (p0 && live.length) {
            // camera right axis on the ground, and how many pixels a metre along it is at the speaker
            const e = cam.matrixWorld.elements, rx = e[0], rz = e[2], rl = Math.hypot(rx, rz) || 1;
            const p1 = scr(target.x + rx / rl, target.z + rz / rl, target.bubbleY ?? 2.6), ppm = p1 ? Math.max(4, Math.abs(p1[0] - p0[0])) : 40;
            const hit = (px, py) => live.find(b => { const q = scr(b.anchor.x, b.anchor.z, b.anchor.bubbleY ?? 2.6); return q && Math.abs(q[0] - px) < 190 && Math.abs(q[1] - py) < (two ? 58 : 44); });
            let ok = !hit(p0[0], p0[1]);
            for (const k of [1, -1, 2, -2]) {
                if (ok) break;
                const m = (k * 200) / ppm, px = p0[0] + k * 200;
                if (px < 60 || px > W - 60 || hit(px, p0[1])) continue;
                ox = rx / rl * m; oz = rz / rl * m; ok = true;
            }
            if (!ok) { const h = hit(p0[0], p0[1]); if (h && h.pri < pri) drop(h); else return null; }
        }
        const anchor = ox || oz ? { get x() { return target.x + ox; }, get z() { return target.z + oz; }, get bubbleY() { return target.bubbleY; } } : target;
        state._bub.push({ anchor, pri, until: now + 4300 });
        return anchor;
    }
    /** where the car stands and why that is illegal → { illegal, reasons, primary, severity, edge, dir, lat, along } */
    assessParking(P) {
        const x = P.x, z = P.z, y = P.surfY ?? P.y ?? 0.24, US = !this.buc;
        const R = new Set(); let car = null, depth = -Infinity, walk = null;
        const near = this.index.near(x, z, 40, []), nodes = new Set();
        for (const e of near) {
            if (e.tunnel) continue;
            const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, L2 = dx * dx + dz * dz || 1;
            const t0 = ((x - e.a.x) * dx + (z - e.a.z) * dz) / L2, t = clamp(t0, 0, 1);
            const ey = (e.a.y ?? 0) + ((e.b.y ?? 0) - (e.a.y ?? 0)) * t;
            if (Math.abs(ey + 0.24 - y) > 2) continue;
            nodes.add(e.a); nodes.add(e.b);
            const cx = e.a.x + dx * t, cz = e.a.z + dz * t, d = Math.hypot(x - cx, z - cz), lat = (x - cx) * e.nx + (z - cz) * e.nz, hw = roadSideWidth(e, lat);
            if ((t0 < 0 || t0 > 1) && Math.abs(t0 - t) * e.len > 0.8) continue; // past the edge end: the junction pad decides
            if (d < hw + 0.3) { if (hw - d > depth) { depth = hw - d; car = { e, t, d, lat, hw }; } }
            else { const sw = sidewalkWidthOf(this.world, e, lat >= 0 ? 1 : -1, 0); if (sw > 0.6 && d < hw + sw + 1.2 && !walk) walk = { e, t, d, lat, hw }; }
        }
        for (const n of nodes) {
            const d = Math.hypot(x - n.x, z - n.z), rad = n.radius ?? 6;
            if (this.isJunction(n) && n.edges.length >= 3 && d < rad + 0.3) R.add('junction');
            if ((n.zebra || n.crossing) && n.edges.length <= 2 && d < 14) for (const g of n.edges) { // (marked crossing: 0–3 m past the node, carriageway-wide)
                const sg = g.a === n ? 1 : -1, al = ((x - n.x) * g.dirx + (z - n.z) * g.dirz) * sg, la = Math.abs((x - n.x) * g.nx + (z - n.z) * g.nz);
                if (al > -2.5 && al < 5 && la < roadSideWidth(g, roadLateral(g, x, z)) + 0.3) R.add('zebra');
            }
            if ((n.hasLight || n.zebra) && n.edges.length >= 3 && car && (car.e.a === n || car.e.b === n)) {
                const ds = (car.e.a === n ? car.t : 1 - car.t) * car.e.len; if (ds > rad - 1 && ds < rad + 6) R.add('zebra'); // the crossing in front of the stop line
            }
            const all = n.allEdges || n.edges;
            if (d < 7 && (car || walk) && all.some(g => g.type === 'service') && all.some(g => g.type !== 'service')) R.add('driveway');
        }
        for (const e of near) if (e.tramOnly && Math.hypot(x - (e.a.x + e.b.x) / 2, z - (e.a.z + e.b.z) / 2) < e.len / 2 + 2) {
            const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, L2 = dx * dx + dz * dz || 1, t = clamp(((x - e.a.x) * dx + (z - e.a.z) * dz) / L2, 0, 1);
            if (Math.abs(roadLateral(e, x, z) - (e.laneCenterShiftM || 0)) < tramBaseOffset(e) + 2.2) R.add('tram');
        }
        if (car) {
            const e = car.e, side = car.lat >= 0 ? 1 : -1, laneW = e.laneW ?? 3.3;
            if (e.tram && Math.abs(car.lat - (e.laneCenterShiftM || 0)) < tramBaseOffset(e) + 2.1) R.add('tram');
            if (e.busLane && Math.abs(car.lat) > car.hw - laneW - 0.3) R.add('buslane');
            const kerbOk = (/^(residential|unclassified|living_street)$/.test(e.type) || (US && /^(tertiary|secondary)$/.test(e.type))) && Math.abs(car.lat) > car.hw - 2.8;
            if (e.type !== 'service' && !kerbOk && !e.tramOnly) R.add('lane');
            for (const p of this.world.pois || []) {
                if (p.kind !== 'busstop') continue; const px = p.x ?? p.doorX, pz = p.z ?? p.doorZ;
                if (Math.abs(px - x) > 18 || Math.abs(pz - z) > 18 || Math.hypot(px - x, pz - z) > 16) continue;
                const ps = (px - e.a.x - (e.b.x - e.a.x) * car.t) * e.nx + (pz - e.a.z - (e.b.z - e.a.z) * car.t) * e.nz;
                if (Math.sign(ps) === side && Math.abs(car.lat) > car.hw - laneW - 0.5) R.add('busstop');
            }
        } else if (walk) {
            let lot = false;
            for (const a of this.world.areas || []) if (a.kind === 'parking' && x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1 && pointInPoly(x, z, a.outer)) { lot = true; break; }
            if (!lot) R.add('sidewalk');
            for (const p of this.world.pois || []) if (p.kind === 'busstop' && Math.hypot((p.x ?? p.doorX) - x, (p.z ?? p.doorZ) - z) < 8) R.add('busstop');
        }
        if (US) for (const h of this.hydrants()) if (Math.hypot(h.x - x, h.z - z) < 4.6) { R.add('hydrant'); break; } // 15 ft
        const order = ['tram', 'junction', 'zebra', 'busstop', 'buslane', 'hydrant', 'driveway', 'lane', 'sidewalk'];
        const reasons = order.filter(r => R.has(r)), primary = reasons[0] || null;
        const severity = !primary ? null : reasons.some(r => r !== 'sidewalk') ? 'obstruct' : 'mild';
        let dir = 1, along = 0;
        if (car) { const hx = -Math.sin(P.heading), hz = -Math.cos(P.heading); dir = car.e.dirx * hx + car.e.dirz * hz >= 0 ? 1 : -1; if (!canTravel(car.e, dir) && canTravel(car.e, -dir)) dir = -dir; along = (dir > 0 ? car.t : 1 - car.t) * car.e.len; }
        return { illegal: !!primary, reasons, primary, severity, edge: car?.e || walk?.e || null, inLane: !!car, dir, lat: car ? car.lat * dir : 0, along, blockEdge: car && (R.has('lane') || R.has('junction') || R.has('tram') || R.has('zebra')) ? car.e : null };
    }
    hydrants() {
        if (this._hyd) return this._hyd;
        const out = this._hyd = [], F = this.world.data?.furniture || [], K = this.world.data?.furnKinds || [];
        for (let i = 0; i + 2 < F.length; i += 3) if (K[F[i]] === 'fire_hydrant') out.push({ x: F[i + 1] / 10, z: F[i + 2] / 10 });
        return out;
    }
    fineFor(kind) {
        // Romania (OUG 195/2002 art. 108 classes; 1 penalty point = 10 % of the gross minimum wage = 216.25 lei since
        // 1 July 2026, HG 146/2026; press summaries, spec 13 log): sidewalk parking that still leaves room = class I
        // (2–3 points), stopping on a crossing / in a junction / on tram tracks / in a stop or a lane = class II (4–5 points);
        // the minimum of the class is shown. Bucharest tow + pound fees vary by sector (not confirmed): offence fine only.
        // US: Bellevue / SeaTac amounts not confirmed → amount null (gameplay shows "Fine" without a number).
        const st = this.park, obstruct = st?.check?.severity === 'obstruct', PT = 216.25;
        if (this.buc) {
            const pts = obstruct ? 4 : 2, amt = Math.round(pts * PT * 100) / 100, hi = Math.round((pts + 1) * PT * 100) / 100;
            const cls = obstruct ? 'clasa a II-a' : 'clasa I';
            if (kind === 'tow') return { amount: amt, currency: 'RON', label: `Amendă (${cls}) + ridicare auto (taxa de ridicare se plătește separat)`, range: [amt, hi] };
            if (kind === 'clamp') return { amount: amt, currency: 'RON', label: `Amendă (${cls}) + blocare roți`, range: [amt, hi] };
            return { amount: amt, currency: 'RON', label: `Amendă Poliția Locală (${cls}, ${pts}–${pts + 1} puncte)`, range: [amt, hi] };
        }
        return { amount: null, currency: 'USD', label: kind === 'tow' ? 'Tow + impound' : 'Parking citation' };
    }
    updateParking(dt) {
        const P = this.player, W = this.walker;
        const parked = !!(P && W && W.active && Math.abs(P.speed || 0) < 0.3);
        let st = this.park;
        if (st && (!parked || Math.hypot(P.x - st.x, P.z - st.z) > 1.5)) { const towed = !!st.S.tow; this.endParking(towed ? 'towed' : parked ? 'moved' : 'driven-off'); st = null; if (towed && parked) this._towedTo = { x: P.x, z: P.z }; }
        if (!parked) return;
        if (!st) {
            const check = this.assessParking(P);
            // where the tow truck left it (gameplay moves the car on 'tow'): the pound's spot, nobody reacts to it again
            const tw = this._towedTo; if (tw && Math.hypot(P.x - tw.x, P.z - tw.z) < 3) { check.illegal = false; check.towed = true; check.blockEdge = null; } else this._towedTo = null;
            st = this.park = { x: P.x, z: P.z, heading: P.heading, t: 0, check, S: {}, seen: new Set(), bubbleT: 1.5, driverT: 2, scanT: 0, log: [], officer: null, truck: null, props: [], blockEdge: check.blockEdge };
            this.parking = { illegal: check.illegal, reasons: check.reasons, primary: check.primary, severity: check.severity, t: 0, log: st.log };
            if (check.illegal) this.emitParking('illegal');
            return;
        }
        if (!st.check.illegal) return;
        st.t += dt; this.parking.t = st.t;
        const S = st.S, US = !this.buc, L = US ? PARK_US : PARK_RO, rsn = st.check.primary, rng = this.rng;
        const pick = (arr) => arr && arr.length ? arr[Math.floor(rng() * arr.length)] : null;
        st.bubbleT -= dt; st.driverT -= dt; st.scanT -= dt;
        // ---- passers-by
        if (st.scanT <= 0) {
            st.scanT = 0.25;
            for (const p of this.peds.near(st.x, st.z, 15)) {
                if (st.bubbleT > 0) break;
                if (st.seen.has(p) || p.agent || p.react || p.onRoad || p.state === 'down') continue;
                st.seen.add(p); if (st.t < 2.5 || rng() > 0.75) continue;
                const r = rng(), face = { x: st.x, z: st.z };
                let kind = r < (US ? 0.6 : 0.5) ? 'remark' : r < (US ? 0.78 : 0.8) ? 'photo' : US && !S.note && st.t > 8 ? 'note' : 'call';
                if (kind === 'call' && S.report && rng() < 0.6) kind = 'remark';
                let line = null;
                if (kind === 'remark') line = rng() < 0.55 ? pick(L.reason[rsn]) || pick(L.remark) : pick(L.remark);
                else if (kind === 'photo') line = pick(L.photo);
                else if (kind === 'note') line = pick(L.note);
                if (kind === 'call') { const c = pick(L.call), w = L.where[rsn] || L.where.lane; line = { t: c.t.replace('{where}', w.t), en: c.en ? c.en.replace('{where}', w.en || w.t) : undefined }; }
                p.react = { t: kind === 'remark' ? rng.range(2, 3.5) : rng.range(3.5, 5), x: face.x, z: face.z, pose: kind === 'photo' ? 'photo' : kind === 'call' ? 'phone' : kind === 'note' ? 'point' : 'talk', prop: kind === 'photo' || kind === 'call' ? 'phone' : null };
                if (this.say(p, line,'',2,{simulation:true})) st.bubbleT = rng.range(2.2, 3.6);
                this.emitParking(kind === 'remark' ? 'noticed' : kind === 'photo' ? 'photo' : kind === 'note' ? 'note' : 'report', { by: 'passer-by' });
                if (kind === 'note') { S.note = true; this.addCarProp('note'); }
                if (kind === 'call') S.report = true;
            }
        }
        if (!S.report && st.t > (US ? 30 : 22)) { S.report = true; this.emitParking('report', { by: 'someone' }); }
        if (US && !S.note && st.t > 20) { S.note = true; this.addCarProp('note'); this.emitParking('note', { by: 'someone' }); }
        // ---- blocked drivers: queue, honk (Bucharest: a lot), remarks, go round (tryBypass / routing)
        if (st.driverT <= 0) {
            st.driverT = 0.5;
            for (const v of this.near(st.x, st.z, 32)) {
                if (v.parked || v.service || v.leader !== P || v.speed > 0.5 || (v.blockT || 0) < 1.5) continue;
                if (rng() < (US ? 0.15 : 0.55)) this.onHonk(v, 'stuck');
                if (st.bubbleT <= 0 && rng() < 0.6 && this.say(v, pick(L.driver), '', 1,{simulation:true})) { st.bubbleT = rng.range(2, 3); st.driverT = 3; this.stats.parkingHonks = (this.stats.parkingHonks || 0) + 1; }
                break;
            }
        }
        // ---- the authorities
        const obstruct = st.check.severity === 'obstruct';
        if (!S.officer && st.t > (US ? 42 : obstruct ? 36 : 45)) { S.officer = true; this.callOfficer(st); }
        if (S.arrived != null && !S.ticket && st.t > S.arrived + 6) {
            S.ticket = true;
            const off = st.officer;
            if (!US && !obstruct) { this.addCarProp('clamp'); this.emitParking('clamp', { fine: this.fineFor('clamp') }); this.say(off, pick(L.clamp), '', 3); }
            else { this.addCarProp('ticket'); this.emitParking('ticket', { fine: this.fineFor('ticket') }); this.say(off, pick(L.ticket), '', 3); }
        }
        if (obstruct && !S.truck && st.t > (US ? 70 : 50)) { S.truck = true; this.callTowTruck(st); }
        if (S.truckAt != null && !S.tow && st.t > S.truckAt + (US ? 12 : 10)) { S.tow = true; this.emitParking('tow', { fine: this.fineFor('tow') }); this.say(st.truck || st.officer, pick(L.tow), '', 3); }
        if (st.truck) { const on = ((this.time * 3) | 0) % 2 === 0; if (st.beacon) st.beacon.visible = on; st.truck.mesh.userData.setLights?.(on); }
    }
    /** the officer: a passer-by in uniform walks up to the car, writes the ticket / fits the clamp */
    callOfficer(st) {
        const peds = this.peds, P = this.player, W = this.walker; if (!peds.list.length) return;
        // a walker 25–120 m away (else anyone not busy), reused as the officer
        let best = null, bd = Infinity;
        for (const p of peds.list) { if (p.agent || p.react || p.state === 'down' || p.onRoad) continue; const d = Math.hypot(p.x - st.x, p.z - st.z); const sc = d < 25 ? 1e6 + d : Math.abs(d - 60); if (sc < bd) { bd = sc; best = p; } }
        if (!best) return;
        const e = st.check.edge, fx = -Math.sin(st.heading), fz = -Math.cos(st.heading), lx = fz, lz = -fx, w = (P.width || 1.8) / 2;
        // stand by the driver's door on the kerb side when the car is at the kerb, else beside the driver's door
        let tx = st.x + lx * (w + 0.8), tz = st.z + lz * (w + 0.8);
        // walk in from ~22 m behind the car along its sidewalk (out of the carriageway when possible)
        let sx = st.x - fx * 22 + lx * (w + 3), sz = st.z - fz * 22 + lz * (w + 3);
        if (e) { const side = ((st.x - e.a.x) * e.nx + (st.z - e.a.z) * e.nz) >= 0 ? 1 : -1, o = roadSideWidth(e, side) + 1.6, t = clamp(((st.x - e.a.x) * e.dirx + (st.z - e.a.z) * e.dirz) - 22 * Math.sign(fx * e.dirx + fz * e.dirz || 1), 0, e.len); sx = e.a.x + e.dirx * t + e.nx * o * side; sz = e.a.z + e.dirz * t + e.nz * o * side; }
        if (W && Math.hypot(sx - W.x, sz - W.z) < 6) { sx = st.x + fx * 24; sz = st.z + fz * 24; }
        best.x = sx; best.z = sz; peds.kerbClamp(best); peds.obsClamp(best);
        best.outfit0 = true; const o = dressFor(this.city.id, undefined, null, this.rng);
        try { peds.crowd.dress(best.i, { ...o, top: this.buc ? '#1c2a4a' : '#16213a', bottom: '#151b29', flags: 4 }); } catch { /* old crowd */ }
        best.agent = { x: tx, z: tz, fx: st.x, fz: st.z, pose: 'phone', prop: 'phone', onArrive: () => { st.S.arrived = st.t; this.emitParking('officer', { arrived: true }); } };
        st.officer = best; this.emitParking('officer', { arrived: false });
        this.say(best, (this.buc ? PARK_RO : PARK_US).officer[0], '', 3);
    }
    /** the tow truck ("ridicare auto" / tow company): parks in the lane right in front of the car, beacon flashing */
    callTowTruck(st) {
        const P = this.player, c = st.check, e = c.edge; if (!e) return;
        const dir = canTravel(e, c.dir) ? c.dir : -c.dir, lanes = lanesDir(e, dir) || 1;
        let lane = 0, bd = Infinity; for (let l = 0; l < lanes; l++) { const d = Math.abs(laneOffset(e, l, dir) - c.lat * (dir === c.dir ? 1 : -1)); if (d < bd) { bd = d; lane = l; } }
        const kind = VEH.VEHICLE_KINDS?.includes?.('truck') ? 'truck' : 'van', Lt = this.kindLength(kind), Lc = P.length || 4.4;
        const along = dir === c.dir ? c.along : e.len - c.along;
        let s = along + Lc / 2 + Lt / 2 + 1.2; if (s + Lt / 2 > e.len - 1) s = along - Lc / 2 - Lt / 2 - 1.2;
        if (s - Lt / 2 < 0.5) return;
        const v = this.spawn({ edge: e, dir, lane, s, kind });
        v.service = 'tow'; v.parked = true; v.mesh.userData.parked = true; v.speed = 0; v.hazard = true;
        v.lateralExtra = v.latExtraCur = clamp(c.lat * (dir === c.dir ? 1 : -1) - laneOffset(e, lane, dir), -4, 4);
        this.placeOnLane(v, true, 0);
        const h = VEH.vehicleSize?.(kind, this.city.id)?.height || 3;
        const b = st.beacon = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.3), new THREE.MeshBasicMaterial({ color: '#ffae00' }));
        b.position.set(0, h + 0.08, -Lt * 0.3); v.mesh.add(b);
        for (const o of this.near(v.x, v.z, 16)) if (o !== v && !o.service && !o.inactive && vvPen(v, o) > -0.3) { if (!(this.large && this.relocate(o, 250, this.bubble, true))) this.respawn(o); }
        this.grid.build(this.vehicles);
        st.truck = v; st.S.truckAt = st.t;
        this.emitParking('towtruck');
        this.say(v, (this.buc ? PARK_RO : PARK_US).truck[0], '', 3);
    }
    /** paper under the wiper (note / ticket) or a yellow wheel clamp on the parked car */
    addCarProp(kind) {
        const st = this.park, P = this.player; if (!st || !P) return;
        if (st.props.some(m => m.userData.kind === kind)) return;
        const fx = -Math.sin(st.heading), fz = -Math.cos(st.heading), lx = fz, lz = -fx, w = (P.width || 1.8) / 2, y0 = P.surfY ?? 0.24;
        const g = new THREE.Group(); g.userData.kind = kind;
        if (kind === 'clamp') {
            const yel = new THREE.MeshBasicMaterial({ color: '#f5c518' }), red = new THREE.MeshBasicMaterial({ color: '#c81e1e' });
            const disc = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.52, 0.52), yel), arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.6), red);
            disc.position.set(0, 0.33, 0); arm.position.set(0.02, 0.62, 0); g.add(disc, arm);
            g.position.set(st.x + fx * 1.25 + lx * (w + 0.06), y0, st.z + fz * 1.25 + lz * (w + 0.06));
            g.rotation.y = st.heading;
        } else {
            const paper = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.28), new THREE.MeshBasicMaterial({ color: kind === 'note' ? '#fde68a' : '#fb923c' }));
            g.add(paper);
            const side = kind === 'note' ? 0.38 : -0.3;
            g.position.set(st.x + fx * 0.9 + lx * side, y0 + 1.02, st.z + fz * 0.9 + lz * side);
            g.rotation.set(-0.55, st.heading, 0, 'YXZ');
        }
        this.group.add(g); st.props.push(g);
    }
    endParking(why) {
        const st = this.park; if (!st) return;
        if (st.check.illegal) this.emitParking('cleared', { why, stages: Object.keys(st.S) });
        for (const m of st.props) { this.group.remove(m); m.traverse(o => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
        const off = st.officer;
        if (off) { off.agent = null; off.pose = 0; off.prop = null; try { this.peds.crowd.dress(off.i, null); } catch { /* ignore */ } if (off.state === 'walk' && off.e) this.peds.placeWalk(off); else off.state = off.e ? 'walk' : 'stand'; if (off.state === 'walk') this.peds.placeWalk(off); }
        const v = st.truck;
        if (v) { const i = this.vehicles.indexOf(v); if (i >= 0) this.vehicles.splice(i, 1); v.inactive = true; v.mesh.visible = false; if (st.beacon) v.mesh.remove(st.beacon); this.group.remove(v.mesh); this.grid.build(this.vehicles); }
        this.park = null; this.parking = null;
    }
}

// ============================================================================
//  PEDESTRIANS
// ============================================================================
const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#f5d6bd'];
const CLOTHES_B = ['#1f2937', '#374151', '#7f1d1d', '#1e3a8a', '#4b5563', '#0f172a', '#78350f', '#6b21a8', '#9ca3af', '#065f46'];
const CLOTHES_S = ['#1f2937', '#334155', '#0f766e', '#1d4ed8', '#4b5563', '#7c2d12', '#facc15', '#111827'];

export class Pedestrians {
    constructor(traffic, count) {
        this.t = traffic; this.rng = makeRng(traffic.buc ? 321 : 654);
        this.list = []; this.grid = new Grid(8, 11);
        this.stats = { pushes: 0 };
        this.crossCount = new Map();
        const edges = traffic.world.graph.edges.filter(e => this.ok(e));
        const cum = new Float64Array(edges.length); let wsum = 0;
        edges.forEach((e, i) => { const m = Math.min(2, trafficMulOf(e)); wsum += e.len * (0.15 + m * m * 0.8 + (e.busRoute ? 0.4 : 0)); cum[i] = wsum; }); // busy boulevards (Magheru, Unirii, Romană) get most walkers
        const pick = () => { const r = this.rng() * wsum; let lo = 0, hi = edges.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return edges[lo]; };
        const stops = this.stops = (traffic.world.pois || []).filter(p => p.kind === 'busstop');
        if (!edges.length) count = 0;
        // geometry
        // rendering (vehicles/cockpit-ui, crowd.js): instanced people with clothes by city / season / weather, walk cycle in the shader
        this.crowd = makeCrowd({ max: Math.max(1, count), city: traffic.city?.id || (traffic.buc ? 'bucharest' : 'seattle'), rng: makeRng(traffic.buc ? 4321 : 8765) });
        this.group = this.crowd.object; // (visual harness hides peds via .group)
        const clothes = traffic.buc ? CLOTHES_B : CLOTHES_S;
        for (let i = 0; i < count; i++) {
            const p = { i, x: 0, z: 0, heading: 0, speed: this.rng.range(1.05, 1.6), state: 'walk', legs: [], waitT: 0, phase: this.rng() * 6, downT: 0, onRoad: false, scale: this.rng.range(0.92, 1.1), get bubbleY() { return 0.2 + 1.95 * this.scale; } }; // (bubbleY: chat bubbles sit just above the head, not at the 2.6 m driver height)
            if (stops.length && i < Math.min(count * 0.1, stops.length * 3)) { // (≤ 3 per stop at the start: they piled up)
                const st = stops[i % stops.length]; const sx = st.x ?? st.doorX, sz = st.z ?? st.doorZ;
                const a = this.rng() * 6.28, r = this.rng.range(0.4, 2.2);
                p.state = 'stand'; p.x = sx + Math.cos(a) * r; p.z = sz + Math.sin(a) * r;
                const ne = traffic.index.nearest(sx, sz, 60); p.heading = ne ? Math.atan2(-(ne.cx - sx), -(ne.cz - sz)) : 0;
                this.kerbClamp(p);
            } else {
                const e = pick(); p.e = e; p.dir = this.rng() < 0.5 ? 1 : -1; p.side = this.rng() < 0.5 ? 1 : -1;
                if (this.width(e, p.side) <= 0) p.side = -p.side; // same original draw; deterministic legal-side repair
                p.s = this.rng.range(0, e.len); this.placeWalk(p);
            }
            this.list.push(p);
            this.rng.pick(clothes); this.rng.pick(SKIN); // (kept: same random sequence for the ped logic as before the crowd renderer)
        }
        this.crowd.count = count;
        traffic.group.add(this.crowd.object);
        this.buildObstacles();
        for (const p of this.list) {
            if (p.state === 'walk') this.placeWalk(p); else this.clearObstacles(p);
            if (this.inWater(p.x, p.z) && p.e && this.width(p.e, -p.side) > 0) { p.side = -p.side; p.state = 'walk'; this.placeWalk(p); } // (spawned on water: only an actual other sidewalk)
        }
        // Resolve crossing street mouths before these bodies are admitted to the
        // visible crowd. Live recovery keeps its normal walking-speed limit.
        for (const p of this.list) this.admitInitialWalk(p);
        for (const p of this.list) this.admitInitialStand(p);
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(0, 0, 0, 'YXZ');
        this.buildGrid();
        this.writeMatrices(0);
        for (const p of this.list) p.live = true;
    }
    /** Source and destination must both be hidden before a population recycle. */
    inView(p) {
        const P = this.t.walker?.active ? this.t.walker : this.t.player; if (!P) return false;
        const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
        if (d < 70 || (d < 230 && dx * P.fx + dz * P.fz > -2)) return true;
        // Looking back / a drone can see behind the player's travel direction.
        const G = globalThis.game;
        if (G?.traffic !== this.t) return false;
        if (!this._views || this._viewFrame !== this._fr) {
            this._viewFrame = this._fr; this._views = [];
            const cams = [this.t.observerCamera || G.camera];
            if (!this.t.observerCamera && !this.t.walker?.active && this.t.player?.mirrorEnabled) cams.push(this.t.player.mirrorCam);
            for (const camera of cams) if (camera) {
                camera.updateWorldMatrix(true, false);
                const m = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
                this._views.push({ frustum: new THREE.Frustum().setFromProjectionMatrix(m), position: new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld), far: Math.min(300, camera.far) });
            }
        }
        const sphere = this._viewSphere || (this._viewSphere = new THREE.Sphere(new THREE.Vector3(), 4));
        sphere.center.set(p.x, 1.1, p.z);
        return this._views.some(v => v.position.distanceTo(sphere.center) < v.far && v.frustum.intersectsSphere(sphere));
    }
    /** Keep the physical pose and walk to a recovery target instead of snapping. */
    recoverPose(p, x, z) {
        if (!p.live || p.relocating || Math.hypot(p.x - x, p.z - z) < 0.08) return;
        const cross = !!(p.onRoad || this.roadAt(x, z) || this.roadAt(p.x, p.z) || this.roadAt((p.x + x) / 2, (p.z + z) / 2));
        p.recovery = { x: p.x, z: p.z, state: p.recovery?.state || p.state, onRoad: p.recovery?.onRoad ?? p.onRoad, legs: p.recovery?.legs || p.legs };
        p.legs = [{ x: p.x, z: p.z, cross, started: true, recovery: true }];
        p.x = x; p.z = z; p.state = 'legs'; p.onRoad = cross;
    }
    /** big worlds: put a pedestrian on a sidewalk / bus stop rMin..rMax from the player */
    relocate(p, rMin, rMax, hidden) {
        const T = this.t, P = T.player; if (!P) return;
        if (hidden && this.inView(p)) return;
        const peers=relocationPeerQuery(this.list,p,o=>this.reach(o));
        const saved = { x: p.x, z: p.z, e: p.e, dir: p.dir, side: p.side, s: p.s, state: p.state, legs: p.legs, waitT: p.waitT, onRoad: p.onRoad, recovery: p.recovery, relocating: false, next: p.next, walkOff: p.walkOff, walkGoal: p.walkGoal, dodge: p.dodge, dodgeEdge: p.dodgeEdge, dodgeFrame: p.dodgeFrame, heading: p.heading };
        p.recovery = null; p.relocating = true;
        if (p.state === 'stand' && this.stops.length) {
            for (let tries = 0; tries < 40; tries++) {
                const st = this.stops[Math.floor(this.rng() * this.stops.length)]; const sx = st.x ?? st.doorX, sz = st.z ?? st.doorZ;
                const d = Math.hypot(sx - P.x, sz - P.z); if (d < rMin || d > rMax) continue;
                // (2026-11-08, owner: "stuck people") at most 4 waiting at a stop: a dozen squeezed between the kerb and the
                // shelter stood inside each other
                if (peers.standingCount(sx,sz,4) >= 4) continue;
                const a = this.rng() * 6.28, r = this.rng.range(0.4, 2.2); p.x = sx + Math.cos(a) * r; p.z = sz + Math.sin(a) * r; this.kerbClamp(p);
                if (this.inWater(p.x, p.z) || !this.freeWalkPoint(p.x, p.z, this.reach(p)) || !this.freePersonalSpace(p,peers)) continue; // a shelter is not extra standing capacity
                if (hidden && this.inView(p)) continue;
                p.relocating = false; return;
            }
            p.state = 'walk';
        }
        // Sample actual free walking slots, not road records: a 6 m split link
        // must not receive the same population as a 200 m boulevard.
        const cands = [];
        let total = 0;
        for (const e of T.nearEdges(420)) {
            if (!this.ok(e)) continue;
            const mx = (e.a.x + e.b.x) / 2 - P.x, mz = (e.a.z + e.b.z) / 2 - P.z, d = Math.hypot(mx, mz);
            if (d < rMin || d > rMax || (hidden && d < 250 && mx * P.fx + mz * P.fz > 0)) continue;
            for (const side of [-1, 1]) {
                const space = this.walkSpace(e, side), load = this.spaceLoad(e, side, p,peers);
                const free = Math.max(0, space.cells.length - load);
                if (!free) continue;
                total += free * (0.2 + Math.min(0.8, trafficMulOf(e) * 0.45));
                cands.push({ e, side, space, total });
            }
        }
        for (let tries = 0; total > 0 && tries < 50; tries++) {
            const n = this.rng() * total, c = cands.find(q => q.total >= n);
            const cell = c.space.cells[Math.floor(this.rng() * c.space.cells.length)];
            p.e = c.e; p.side = c.side; p.dir = this.rng() < 0.5 ? 1 : -1; p.s = cell.s;
            p.walkOff = cell.u - this.off(c.e, c.side); p.walkGoal = undefined; p.dodge = 0; p.dodgeEdge = c.e; p.dodgeFrame = this._fr;
            p.state = 'walk'; p.legs = []; p.next = null; p.onRoad = false; p.waitT = 0;
            this.placeWalk(p);
            if (!this.admit(p,peers) || (hidden && this.inView(p))) continue;
            p.animX = p.x; p.animZ = p.z; p.animVX = p.animVZ = 0; p.progressX = p.x; p.progressZ = p.z; p.progressT = 0;
            p.relocating = false; return;
        }
        Object.assign(p, saved);
        if (!p.e) p.state = 'stand'; // nowhere to walk: just stand where we are
    }
    relocateAll() { for (const p of this.list) this.relocate(p, 0, 420, false); this.buildGrid(); this.writeMatrices(); }
    recycle() {
        const P = this.t.player; if (!P || !this.list.length) return;
        for (let k = 0; k < 10; k++) {
            this._rr = ((this._rr || 0) + 1) % this.list.length;
            const p = this.list[this._rr];
            // districts (~1 km²): keep the walkers around the player (a busy street at noon), big legacy maps as before
            const far = this.t.large ? 480 : 230;
            if (p.state !== 'down' && Math.hypot(p.x - P.x, p.z - P.z) > far) this.relocate(p, this.t.large ? 120 : 45, this.t.large ? 420 : 200, true);
        }
    }
    width(e, side, fallback = 3) { return sidewalkWidthOf(this.t.world, e, side, fallback); }
    ok(e) { return !isMotorway(e) && !e.tunnel && !e.bridge && e.len > 4 && Math.max(this.width(e, 1, 1), this.width(e, -1, 1)) > 0 && e.type !== 'dn' && e.type !== 'service'; }
    // (2026-11-08, owner: "people not even walking on it") district worlds: the walking line is the middle of that side's own
    // sidewalk — halfW (the wider half) put the line metres past the sidewalk on the narrow side of asymmetric streets
    off(e, side = 0) {
        if (!side || !this.t.world?.district) return (e.halfW ?? 6) + 1.5;
        const w = (side > 0 ? e.wR : e.wL) ?? e.halfW ?? 6, sw = this.width(e, side), old = sw > 0.3 ? clamp(sw * 0.55, 0.9, 1.6) : 1.5;
        return w + (sourceSideWidth(this.t.world, e, side) ? clamp(old, Math.min(PED_R + .05, sw / 2), Math.max(sw / 2, sw - PED_R - .05)) : old);
    }
    /** how far a walker may drift past its line and still be on the sidewalk (districts; else the legacy 3 m) */
    maxOut(e, side) { const sw = this.width(e, side), known = sourceSideWidth(this.t.world, e, side); if (known && sw <= 0) return 0; if (!this.t.world?.district || (!known && !(e.sidewalk > 0.3))) return 3; const w = (side > 0 ? e.wR : e.wL) ?? e.halfW ?? 6; return Math.max(known ? 0 : 0.2, w + sw - 0.35 - this.off(e, side)); }
    inset(node) { return node.edges.length >= 3 ? (node.radius ?? 6) + 1.2 : 0; }

    reach(p) { return this.crowd.reach?.(p.i) || PED_R; }
    freeWalkPoint(x, z, r = PED_R) {
        if(this.inWater(x,z)||this.roadAt(x,z,r+.05))return false;
        const W=this.t.world,y=(W.walkTop?.(x,z)??.2)+.01;
        return !collideBuildings(W.buildings||[],x,z,r,y);
    }
    /** Walking room, with a one-second headway at the normal 1.2 m/s pace.
     * The kerb, walls, props and intersection mouths consume real slots. */
    walkSpace(e, side) {
        let sides = this._walkSpace.get(e); if (!sides) this._walkSpace.set(e, sides = new Map());
        if (sides.has(side)) return sides.get(side);
        const w = (this.t.world.district ? (side > 0 ? e.wR : e.wL) : null) ?? e.halfW ?? 6;
        const sw = this.width(e, side), gap = 2 * PED_R + 1.2, widthGap = 2 * PED_R + 0.25;
        const lo = Math.min(this.inset(e.a), e.len * 0.45), hi = e.len - Math.min(this.inset(e.b), e.len * 0.45);
        const rows = Math.max(1, Math.floor((hi - lo) / gap)), cols = Math.floor((sw - 0.2) / widthGap), cells = [];
        if (hi - lo >= 2 * PED_R && cols > 0) for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
            const s = lo + (i + 0.5) * (hi - lo) / rows, u = w + (j + 0.5) * sw / cols;
            const x = e.a.x + e.dirx * s + e.nx * u * side, z = e.a.z + e.dirz * s + e.nz * u * side;
            if (this.freeWalkPoint(x, z, PED_R + 0.1)) cells.push({ x, z, s, u });
        }
        const space = { cells, w, sw, lo, hi }; sides.set(side, space); return space;
    }
    /** Count actual bodies and inbound routes, including people on adjacent
     * split records whose bodies already occupy this sidewalk corridor. */
    spaceLoad(e, side, except, peers = null) {
        const space = this.walkSpace(e, side); let n = 0;
        if(peers&&peers.except===except)return peers.spaceLoad(e,side,space,PED_R);
        for (const o of this.list) {
            if (o === except || o.hidden) continue;
            const dx = o.x - e.a.x, dz = o.z - e.a.z, s = dx * e.dirx + dz * e.dirz, u = (dx * e.nx + dz * e.nz) * side;
            const here = s >= space.lo - PED_R && s <= space.hi + PED_R && u >= space.w && u <= space.w + space.sw;
            if (here || ((o.state === 'legs' || o.state === 'wait') && o.next?.e === e && o.next.side === side)) n++;
        }
        return n;
    }
    freePersonalSpace(p, peers = null) {
        const r = this.reach(p);
        if(peers&&peers.except===p)return peers.freePersonalSpace(p,r,.35);
        return !this.list.some(o => o !== p && !o.hidden && Math.hypot(o.x - p.x, o.z - p.z) < r + this.reach(o) + 0.35);
    }
    admit(p, peers = null) {
        return this.spaceLoad(p.e, p.side, p,peers) < this.walkSpace(p.e, p.side).cells.length && this.freeWalkPoint(p.x, p.z, this.reach(p)) && this.freePersonalSpace(p,peers) && this.freeVehiclePoint(p.x, p.z, Math.max(this.reach(p), PED_R + 0.4));
    }
    /** A source sidewalk line can end inside a crossing street's carriageway.
     * Pick a clear existing sidewalk slot before first visibility, without
     * drawing another random number or changing a live person's physical pose. */
    admitInitialWalk(p) {
        if (p.live || p.state !== 'walk' || !p.e) return false;
        const radius = this.reach(p), vehicleRadius = Math.max(radius, PED_R + 0.4);
        if (this.width(p.e, p.side) > 0 && this.freeWalkPoint(p.x, p.z, radius) && this.freeVehiclePoint(p.x, p.z, vehicleRadius) && this.freePersonalSpace(p)) return false;
        const edges = [...new Set([p.e, ...this.t.index.near(p.x, p.z, 60, [])])].filter(e => this.ok(e));
        const candidates = [];
        for (const e of edges) for (const side of [p.side, -p.side]) {
            for (const slot of this.walkSpace(e, side).cells) {
                candidates.push({ e, side, slot, distance: Math.hypot(slot.x - p.x, slot.z - p.z) });
            }
        }
        candidates.sort((a, b) => a.distance - b.distance);
        for (const { e, side, slot } of candidates) {
            const trial = { ...p, e, side, s: slot.s, walkOff: slot.u - this.off(e, side),
                dodge: 0, dodgeEdge: e, dodgeFrame: undefined, recovery: null, legs: [], next: null };
            this.placeWalk(trial);
            if (!this.freeWalkPoint(trial.x, trial.z, radius) || !this.freeVehiclePoint(trial.x, trial.z, vehicleRadius)) continue;
            if (this.list.some(o => o !== p && !o.hidden && Math.hypot(o.x - trial.x, o.z - trial.z) < radius + this.reach(o) + 0.35)) continue;
            for (const key of ['e', 'side', 's', 'walkOff', 'dodge', 'dodgeEdge', 'dodgeFrame',
                'recovery', 'legs', 'next', 'x', 'z', 'heading', 'onDodge']) p[key] = trial[key];
            this.stats.initialWalkRepairs = (this.stats.initialWalkRepairs || 0) + 1;
            return true;
        }
        // Preserve the actor and its source pose if nearby physical capacity is
        // genuinely exhausted; keep that exceptional admission observable.
        this.stats.initialWalkUnresolved = (this.stats.initialWalkUnresolved || 0) + 1;
        return false;
    }
    /** Keep waiting groups at their source stop, repairing only real initial
     * body/prop contacts. This runs before any standing actor becomes visible. */
    admitInitialStand(p) {
        if (p.live || p.state !== 'stand') return false;
        const radius = this.reach(p), vehicleRadius = Math.max(radius, PED_R + 0.4);
        const peersClear = (x, z) => !this.list.some(o => o !== p && !o.hidden &&
            Math.hypot(o.x - x, o.z - z) < radius + this.reach(o) + (o.state === 'stand' ? 0.02 : 0.35));
        if (this.freeWalkPoint(p.x, p.z, radius) && this.freeVehiclePoint(p.x, p.z, vehicleRadius) && peersClear(p.x, p.z)) return false;
        const stop = this.stops[p.i % this.stops.length], sx = stop?.x ?? stop?.doorX, sz = stop?.z ?? stop?.doorZ;
        // The traffic graph need not contain a road beside a mapped stop
        // platform. First clear a small contact within its existing waiting
        // area and ground level, without requiring a distant road's slot.
        if (Number.isFinite(sx) && Number.isFinite(sz)) {
            const local = [], top = this.t.world.walkTop?.(p.x, p.z) ?? 0.2;
            for (let dx = -1.44; dx <= 1.44; dx += 0.12) for (let dz = -1.44; dz <= 1.44; dz += 0.12) {
                const distance = Math.hypot(dx, dz), x = p.x + dx, z = p.z + dz;
                if (distance > 1.5 || Math.hypot(x - sx, z - sz) > 8 || Math.abs((this.t.world.walkTop?.(x, z) ?? 0.2) - top) > 0.2) continue;
                local.push({ x, z, distance });
            }
            local.sort((a, b) => a.distance - b.distance);
            for (const c of local) {
                if (!this.freeWalkPoint(c.x, c.z, radius) || !this.freeVehiclePoint(c.x, c.z, vehicleRadius) || !peersClear(c.x, c.z)) continue;
                p.x = c.x; p.z = c.z;
                this.stats.initialStandRepairs = (this.stats.initialStandRepairs || 0) + 1;
                return true;
            }
        }
        const near = Number.isFinite(sx) && Number.isFinite(sz) ? this.t.index.nearest(sx, sz, 12, e => this.ok(e)) : null;
        if (near) {
            const root = near.edge, lat = (sx - root.a.x) * root.nx + (sz - root.a.z) * root.nz, stopSide = lat >= 0 ? 1 : -1;
            const rootWidth = (stopSide > 0 ? root.wR : root.wL) ?? root.halfW ?? 6;
            // Some source stop points are on the road axis, so their sidewalk
            // side is not encoded. Otherwise retain the source stop's side.
            const sideKnown = Math.abs(lat) > rootWidth;
            const cells = [];
            for (const e of this.t.index.near(sx, sz, 16, []).filter(e => this.ok(e))) {
                const s0 = clamp((sx - e.a.x) * e.dirx + (sz - e.a.z) * e.dirz, 0, e.len);
                for (const side of [1, -1]) {
                    const width = (side > 0 ? e.wR : e.wL) ?? e.halfW ?? 6, sw = this.width(e, side);
                    for (let ds = -8; ds <= 8; ds += 0.55) for (let u = width + radius + 0.08; u <= width + sw - radius - 0.08; u += 0.55) {
                        const s = clamp(s0 + ds, 0, e.len), x = e.a.x + e.dirx * s + e.nx * u * side, z = e.a.z + e.dirz * s + e.nz * u * side;
                        if (Math.hypot(x - sx, z - sz) > 8 || (sideKnown && ((x - root.a.x) * root.nx + (z - root.a.z) * root.nz) * stopSide <= rootWidth)) continue;
                        cells.push({ x, z });
                    }
                }
            }
            cells.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
            for (const c of cells) {
                if (!this.freeWalkPoint(c.x, c.z, radius) || !this.freeVehiclePoint(c.x, c.z, vehicleRadius) || !peersClear(c.x, c.z)) continue;
                p.x = c.x; p.z = c.z;
                this.stats.initialStandRepairs = (this.stats.initialStandRepairs || 0) + 1;
                return true;
            }
        }
        this.stats.initialStandUnresolved = (this.stats.initialStandUnresolved || 0) + 1;
        return false;
    }
    /** A blocked recovery must not keep aiming through a pole or a crowd.
     * Change its route from its physical pose; normal walking supplies every step. */
    freeVehiclePoint(x, z, r = PED_R + 0.4) {
        const G = this.t.grid; if (!G?.items) return true;
        let clear = true;
        G.query(x, z, 12, v => {
            if (!clear || v.inactive || !streetLevel(v)) return;
            const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading), dx = x - v.x, dz = z - v.z;
            if (Math.abs(dx * fx + dz * fz) < v.length / 2 + r + 0.05 && Math.abs(-dx * fz + dz * fx) < v.width / 2 + r + 0.05) clear = false;
        });
        return clear;
    }
    clearWalkStep(x, z, escaping) {
        const W = this.t.world;
        return (escaping || !this.roadAt(x, z, PED_R)) && !this.inWater(x, z) && !collideBuildings(W.buildings || [], x, z, PED_R, (W.walkTop?.(x, z) ?? 0.2) + 0.01) && this.freeVehiclePoint(x, z);
    }
    clearWalkSegment(a, b, escaping) {
        const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3));
        for (let k = 1; k <= n; k++) if (!this.clearWalkStep(a.x + (b.x - a.x) * k / n, a.z + (b.z - a.z) * k / n, escaping)) return false;
        return true;
    }
    /** A local walking detour for a blocked recovery, including the corners of
     * parked cars. Every segment uses the same vehicle clearance as walking. */
    escapeRoute(p, goals, escaping) {
        if(this._escapeFrame!==this._fr){this._escapeFrame=this._fr;this._escapeSearches=0;}
        if(this._escapeSearches>=1)return null;this._escapeSearches++;
        const stride = 0.7, extent = 16, key = (i, j) => (i + extent) * (2 * extent + 1) + j + extent;
        const first = { i: 0, j: 0, x: p.x, z: p.z, cost: 0, prev: null }, open = [first], seen = new Map([[key(0, 0), first]]);
        const heuristic = q => Math.min(...goals.map(g => Math.hypot(g.x - q.x, g.z - q.z)));
        first.score = heuristic(first);
        for (let attempts = 0; open.length && attempts < 900; attempts++) {
            open.sort((a, b) => b.score - a.score); const q = open.pop();
            for (const goal of goals) if (Math.hypot(q.x - goal.x, q.z - goal.z) < 1 && this.clearWalkSegment(q, goal, escaping)) {
                const path = [goal]; for (let a = q; a.prev; a = a.prev) path.push({ x: a.x, z: a.z }); path.reverse();
                // Remove redundant grid steps only when the entire shortcut is clear.
                const legs = []; let from = p;
                for (let i = 0; i < path.length;) { let j = i; while (j + 1 < path.length && this.clearWalkSegment(from, path[j + 1], escaping)) j++; legs.push(path[j]); from = path[j]; i = j + 1; }
                return { goal, legs };
            }
            for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
                if (!di && !dj) continue;
                const i = q.i + di, j = q.j + dj; if (Math.abs(i) > extent || Math.abs(j) > extent) continue;
                const x = p.x + i * stride, z = p.z + j * stride, cost = q.cost + Math.hypot(di, dj) * stride * (this.roadAt(x, z) ? 1.8 : 1), old = seen.get(key(i, j));
                if ((old && old.cost <= cost) || !this.clearWalkSegment(q, { x, z }, escaping)) continue;
                const next = { i, j, x, z, cost, score: cost + heuristic({ x, z }), prev: q }; seen.set(key(i, j), next); open.push(next);
            }
        }
        return null;
    }
    replanWalk(p) {
        if ((p.onRoad && !p.recovery && !p.legs?.[0]?.escape) || p.agent || p.react || p.talkT > 0) return false;
        const escaping = !!(p.onRoad || this.roadAt(p.x, p.z)), goals = [];
        let best = null, bd = Infinity, route = null;
        for (const e of this.t.index.near(p.x, p.z, 20, [])) {
            if (!this.ok(e)) continue;
            const dx = p.x - e.a.x, dz = p.z - e.a.z, along = dx * e.dirx + dz * e.dirz;
            if (along < -8 || along > e.len + 8) continue;
            const nearSide = dx * e.nx + dz * e.nz >= 0 ? 1 : -1;
            for (const side of escaping ? [nearSide, -nearSide] : [nearSide]) {
                if (!this.walkSpace(e, side).cells.length) continue;
                for (const shift of [0, -2, 2, -4, 4, -8, 8]) {
                    const s = clamp(along + shift, 0, e.len), u = this.off(e, side), x = e.a.x + e.dirx * s + e.nx * u * side, z = e.a.z + e.dirz * s + e.nz * u * side, d = Math.hypot(x - p.x, z - p.z);
                    if (!this.freeWalkPoint(x, z) || !this.freeVehiclePoint(x, z)) continue;
                    const goal = { e, side, x, z, s }; goals.push(goal);
                    if (d < bd && this.clearWalkSegment(p, goal, escaping)) { best = goal; bd = d; }
                }
            }
        }
        if (!best && goals.length) { route = this.escapeRoute(p, goals, escaping); if (route) { best = route.goal; bd = Infinity; } }
        if (!best) return false;
        const dir = best.e === p.e ? -p.dir : 1;
        p.e = best.e; p.side = best.side; p.dir = dir; p.dodge = 0; p.dodgeEdge = p.e;
        p.recovery = null; p.legs = []; p.next = null; p.state = 'walk'; p.onRoad = false;
        p.walkGoal = undefined; p.blockT = p.legStall = 0; p.legBest = undefined;
        this.syncWalkPose(p);
        if (bd > 0.25) {
            p.legs = (route?.legs || [best]).map(q => ({ x: q.x, z: q.z, cross: escaping, started: escaping, sx: p.x, sz: p.z, len: Math.hypot(q.x - p.x, q.z - p.z), back: true, escape: true }));
            p.next = { e: best.e, side: best.side, dir, s: best.s }; p.state = 'legs'; p.onRoad = escaping;
        }
        this.stats.replans = (this.stats.replans || 0) + 1;
        return true;
    }

    // ------------------------------------------------------------------ static obstacles on the sidewalks (note 38)
    /** trees, lamps, poles, bins, signs, shelters, benches, lot cars …: the world's prop colliders (read-only), in a fixed grid */
    buildObstacles() {
        const obs = this.obs = [];
        for (const c of this.t.world.buildings || []) {
            if (!c || !c.prop || c.wall || c.poly || !(c.r > 0) || c.r > 4 || c.yMax !== undefined) continue;
            const box = !(c.hw === c.r && c.hd === c.r) && c.hw > 0 && c.hd > 0;
            const a = c.angle || 0;
            obs.push({ x: c.x, z: c.z, r: c.r, box, hw: box ? c.hw : c.r, hd: box ? c.hd : c.r, c: Math.cos(a), s: Math.sin(a), kind: c.kind || 'prop' });
        }
        this.obsGrid = new Grid(4, 15, true); this.obsGrid.build(obs);
        this._side = new Map(); this._walkSpace = new Map();
        this.t.stats.pedObstacles = obs.length;
    }
    /** push-out of a pedestrian disc (radius R) from obstacle o → [nx, nz, depth] or null */
    obsPush(o, x, z, R) {
        const dx = x - o.x, dz = z - o.z;
        if (!o.box) { const d = Math.hypot(dx, dz), pen = o.r + R - d; if (pen <= 0) return null; return d > 1e-4 ? [dx / d, dz / d, pen] : [1, 0, pen]; }
        const lx = dx * o.c - dz * o.s, lz = dx * o.s + dz * o.c;
        let ex = lx - clamp(lx, -o.hw, o.hw), ez = lz - clamp(lz, -o.hd, o.hd), pen;
        const d = Math.hypot(ex, ez);
        if (d > 1e-4) { if (d >= R) return null; ex /= d; ez /= d; pen = R - d; }
        else { const ox = o.hw - Math.abs(lx), oz = o.hd - Math.abs(lz); if (ox < oz) { ex = Math.sign(lx) || 1; ez = 0; pen = R + ox; } else { ex = 0; ez = Math.sign(lz) || 1; pen = R + oz; } }
        return [ex * o.c + ez * o.s, -ex * o.s + ez * o.c, pen];
    }
    /** deepest overlap of a pedestrian disc at (x, z) with any obstacle (0 = clear) */
    obsDepth(x, z, R = PED_R) {
        let m = 0; if (!this.obsGrid) return 0;
        this.obsGrid.query(x, z, R + 3, (o) => { const q = this.obsPush(o, x, z, R); if (q && q[2] > m) m = q[2]; });
        return m;
    }
    /** move a point / pedestrian out of every obstacle (a few relaxation passes); returns the total push [dx, dz] */
    obsClamp(q, R = PED_R) {
        let tx = 0, tz = 0; if (!this.obsGrid) return null;
        for (let pass = 0; pass < 3; pass++) {
            let any = false;
            this.obsGrid.query(q.x, q.z, R + 3, (o) => { const r = this.obsPush(o, q.x, q.z, R); if (!r) return; const k = r[2] + 0.02; q.x += r[0] * k; q.z += r[1] * k; tx += r[0] * k; tz += r[1] * k; any = true; });
            if (!any) break;
        }
        return tx || tz ? [tx, tz] : null;
    }
    /** a pedestrian ends every step outside every obstacle; walkers shift their sidewalk line instead of being dragged back */
    clearObstacles(p) {
        if(p._obsClearX===p.x&&p._obsClearZ===p.z)return false;
        const oldX = p.x, oldZ = p.z;
        const push = this.obsClamp(p); if (!push){p._obsClearX=p.x;p._obsClearZ=p.z;return false;}
        // a waiter pushed off a shelter / pole into the road: back to the kerb, else another free spot close by
        if (p.state !== 'walk' && !p.onRoad && this.roadAt(p.x, p.z, 0.4)) {
            this.kerbClamp(p);
            if (this.obsDepth(p.x, p.z) > 0.02) for (let k = 0; k < 12; k++) {
                const a = this.rng() * 6.283, r = 0.8 + this.rng() * 2.2, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
                if (!this.roadAt(x, z, 0.5) && this.obsDepth(x, z) < 0.01) { p.x = x; p.z = z; break; }
            }
        }
        if (p.live && !p.relocating) {
            const dt = this._stepDt || 1 / 30;
            if (p._obsPushFrame !== this._fr || !Number.isFinite(p._obsPushLeft)) { p._obsPushFrame = this._fr; p._obsPushLeft = 1.45 * dt; }
            const dx = p.x - oldX, dz = p.z - oldZ, d = Math.hypot(dx, dz), step = Math.min(d, p._obsPushLeft);
            if (d > 0) { p.x = oldX + dx * step / d; p.z = oldZ + dz * step / d; }
            this.guardPeerStep(p, oldX, oldZ, dt, true, true);
            p._obsPushLeft -= Math.hypot(p.x - oldX, p.z - oldZ);
        }
        if (p.state === 'walk' && p.e) this.syncWalkPose(p);
        this.stats.obsPush = (this.stats.obsPush || 0) + 1;
        return true;
    }
    /**
     * Obstacles along the sidewalk line of (e, side), in the edge frame: s along a→b, u = lateral distance from the
     * centreline on that side, half extents hs / hu, and whether the walker may pass on the road side (okIn: stays
     * ≥ 0.45 m off the carriageway) or the building side (okOut: no building / other obstacle there). Cached per edge side.
     */
    sideObs(e, side) {
        let m = this._side.get(e); if (!m) this._side.set(e, m = [null, null]);
        const k = side > 0 ? 1 : 0; if (m[k]) return m[k];
        const out = [], seen = new Set(), base = this.off(e, side), hw = (this.t.world?.district ? (side > 0 ? e.wR : e.wL) : null) ?? e.halfW ?? 6, R = PED_R;
        const W = this.t.world.buildings;
        const inBuilding = (x, z) => { let hit = false; W?.query?.(x, z, 0.5, (c) => { if (!hit && c.poly && !c.prop && pointInPoly(x, z, c.poly)) hit = true; }); return hit; };
        for (let s = 0; s <= e.len + 4.9; s += 5) {
            const sx = e.a.x + e.dirx * Math.min(s, e.len) + e.nx * base * side, sz = e.a.z + e.dirz * Math.min(s, e.len) + e.nz * base * side;
            this.obsGrid.query(sx, sz, 7, (o) => {
                if (seen.has(o)) return; seen.add(o);
                const dx = o.x - e.a.x, dz = o.z - e.a.z, os = dx * e.dirx + dz * e.dirz, ou = (dx * e.nx + dz * e.nz) * side;
                if (os < -4 || os > e.len + 4 || ou < hw - 1 || ou > base + 4.5) return;
                let hs = o.r, hu = o.r;
                if (o.box) { // local x axis in world (c, −s), local z axis (s, c)
                    hs = Math.abs(e.dirx * o.c - e.dirz * o.s) * o.hw + Math.abs(e.dirx * o.s + e.dirz * o.c) * o.hd;
                    hu = Math.abs(e.nx * o.c - e.nz * o.s) * o.hw + Math.abs(e.nx * o.s + e.nz * o.c) * o.hd;
                }
                const need = hu + R + 0.08, uIn = ou - need, uOut = ou + need;
                const at = (u) => [e.a.x + e.dirx * os + e.nx * u * side, e.a.z + e.dirz * os + e.nz * u * side];
                // (2026-11-08, owner: "people get stuck on parked cars — they should go on the road to avoid them, then back
                //  on the sidewalk") a parked car may be passed on the carriageway side, up to ≈ 1.6 m into the lane
                const parked = o.kind === 'parked';
                const okIn = (uIn >= hw + 0.45 || (parked && uIn >= hw - 1.6)) && this.obsDepth(...at(uIn)) < 0.02;
                const pOut = at(uOut), okOut = !inBuilding(pOut[0], pOut[1]) && this.obsDepth(pOut[0], pOut[1]) < 0.02;
                out.push({ s: os, u: ou, hs, hu, okIn, okOut, parked });
            });
        }
        out.sort((a, b) => a.s - b.s);
        return (m[k] = out);
    }
    /** lateral detour (m, + = away from the road) of a walker at its sidewalk position: full clearance beside an
     *  obstacle, ramped in / out over ~1.7 m before and after it (continuous in s, so the walk stays smooth) */
    dodgeAt(p) {
        if (!this.obsGrid || !p.e) return 0;
        const list = this.sideObs(p.e, p.side); if (!list.length) return 0;
        const R = PED_R, line = this.off(p.e, p.side), base = line + (p.walkOff || 0), s = p.s;
        let lo = 0, hi = list.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid].s < s - 7) lo = mid + 1; else hi = mid; }
        let best = 0;
        for (let i = lo; i < list.length && list[i].s < s + 7; i++) {
            const o = list[i], ds = Math.abs(s - o.s) - o.hs - R;
            const w = ds <= 0.1 ? 1 : ds >= 1.8 ? 0 : 1 - (ds - 0.1) / 1.7; if (w <= 0) continue;
            const need = o.hu + R + 0.08; if (Math.abs(base - o.u) >= need) continue;
            const cin = o.u - need, cout = o.u + need;
            // Choose against the fixed sidewalk line. Choosing against walkOff made
            // a passing/collision offset flip the detour to the opposite side in one frame.
            const tgt = o.parked && o.okIn ? cin : o.okIn && o.okOut ? (Math.abs(cin - line) <= Math.abs(cout - line) ? cin : cout) : o.okIn ? cin : cout;
            const sh = (tgt - base) * w; if (Math.abs(sh) > Math.abs(best)) best = sh;
        }
        return best;
    }
    /** harness counter (note 38): pedestrians overlapping a static obstacle by > 5 cm right now (target 0) */
    countObstacleOverlaps() {
        let n = 0, worst = 0, at = null;
        for (const p of this.list) {
            if (p.state === 'down' || p.hidden) continue;
            const d = this.obsDepth(p.x, p.z); if (d > 0.05) { n++; if (d > worst) { worst = d; at = { x: Math.round(p.x * 10) / 10, z: Math.round(p.z * 10) / 10, state: p.state }; } }
        }
        const S = this.t.stats; S.pedObstacleOverlaps = n; S.pedObstacleMax = Math.max(S.pedObstacleMax || 0, n); S.pedObstacleWorst = at ? { depth: Math.round(worst * 100) / 100, ...at } : null;
        return n;
    }
    /** (2026-11-08, owner: "they teleport") back on a sidewalk line, but still where they stand: the gap to the line goes
     *  into s / walkOff (which drifts back at a walking pace) instead of a jump onto it */
    adoptLine(p, x, z) {
        const e = p.e; if (!e || Math.hypot(p.x - x, p.z - z) < 0.05) return;
        const dx = x - p.x, dz = z - p.z;
        p.s = clamp(p.s + dx * e.dirx + dz * e.dirz, 0, e.len);
        p.walkOff = clamp((p.walkOff || 0) + (dx * e.nx + dz * e.nz) * p.side, -0.6, 3);
        this.placeWalk(p);
        this.recoverPose(p, x, z);
    }
    /** A collision correction changes both along-lane and lateral coordinates.
     * Keep that actual pose, including the active detour, on the next walking step. */
    syncWalkPose(p) {
        const e = p.e, dx = p.x - e.a.x, dz = p.z - e.a.z;
        p.s = clamp(dx * e.dirx + dz * e.dirz, 0, e.len);
        p.walkOff = (dx * e.nx + dz * e.nz) * p.side - this.off(e, p.side) - (p.dodge || 0);
    }
    placeWalk(p) {
        const ox = p.x, oz = p.z;
        if (this.width(p.e, p.side) <= 0 && this.width(p.e, -p.side) > 0) { p.side = -p.side; p.walkOff = 0; p.dodge = 0; p.dodgeEdge = null; }
        { const mo = this.maxOut(p.e, p.side); if ((p.walkOff || 0) > mo) p.walkOff = Math.max(mo, p.walkOff - 0.03); } // (stay on the sidewalk: back onto it at a walking pace, not in one jump)
        const e = p.e, target = this.dodgeAt(p);
        if (p.dodge === undefined || p.dodgeEdge !== e) p.dodge = target;
        else if (p.dodgeFrame !== this._fr) p.dodge += clamp(target - p.dodge, -2 * (this._stepDt || 1 / 30), 2 * (this._stepDt || 1 / 30));
        p.dodgeFrame = this._fr; p.dodgeEdge = e;
        const dg = p.dodge, o = (this.off(e, p.side) + (p.walkOff || 0) + dg) * p.side;
        p.onDodge = dg < -0.05; // (stepping round a parked car on the road side: not "lost in a carriageway")
        p.x = e.a.x + e.dirx * p.s + e.nx * o; p.z = e.a.z + e.dirz * p.s + e.nz * o;
        p.heading = Math.atan2(-e.dirx * p.dir, -e.dirz * p.dir);
        if (Math.hypot(p.x - ox, p.z - oz) > 0.25) this.recoverPose(p, ox, oz);
    }
    /** sidewalk point on edge g at distance d from node, on side `side` */
    sidePoint(g, node, d, side) {
        const fromA = g.a === node; const s = fromA ? d : g.len - d; const o = this.off(g, side) * side;
        return { x: g.a.x + g.dirx * s + g.nx * o, z: g.a.z + g.dirz * s + g.nz * o, s };
    }
    buildGrid() { this.grid.build(this.list); this._peerGridDirty = false; }
    ensurePeerGrid(force = false) {
        if (force || this._peerGridDirty) { this.grid.build?.(this.list); this._peerGridDirty = false; }
    }
    notePeerMove(p, oldX, oldZ) {
        const c = this.grid.cell;
        if (c && (Math.floor(p.x / c) !== Math.floor(oldX / c) || Math.floor(p.z / c) !== Math.floor(oldZ / c))) this._peerGridDirty = true;
    }
    /** Normal movement and corrections may not enter another person's body.
     * An existing contact may still take a small, monotonically outward step. */
    peerClearStep(p, x, z, oldX, oldZ) {
        let clear = true;
        const W = this.t.world;let y;
        const check = q => {
            if (!clear || q === p || q.hidden || q.state === 'down') return;
            const d = Math.hypot(x - q.x, z - q.z); if (d >= 2 * PED_R - 1e-6) return;
            if(y===undefined){const top=W.walkTop?.(x,z);y=top==null?.2:top+.01;}
            const qt = W.walkTop?.(q.x, q.z), qy = qt == null ? 0.2 : qt + 0.01;
            if (y + 1.75 * (p.scale || 1) <= qy || qy + 1.75 * (q.scale || 1) <= y) return;
            if (d <= Math.hypot(oldX - q.x, oldZ - q.z) + 1e-6) clear = false;
        };
        // A correction can cross a cell while a separation query is in flight.
        // Keep that query's chains stable; scan the full population until the
        // next safe refresh between actors, rather than miss a moved body.
        if (this._peerGridDirty || !this.grid.items) { for (const q of this.list) check(q); }
        else this.grid.query(x, z, 2 * PED_R + 0.2, check);
        return clear;
    }
    staticWalkClear(p,x,z,oldX,oldZ) {
        const W=this.t.world,B=W.buildings||[],free=p._emptyStatic;
        if(free&&Math.hypot(x-free.x,z-free.z)<=.24)return true;
        if(B.query){let candidate=false;B.query(x,z,PED_R+.25,()=>{candidate=true;});if(!candidate){p._emptyStatic={x,z};return true;}}
        else if(!B.length)return true;
        const height=(x,z)=>(W.walkTop?.(x,z)??.2)+.01,hit=collideBuildings(B,x,z,PED_R,height(x,z));
        if(!hit)return true;
        const before=collideBuildings(B,oldX,oldZ,PED_R,height(oldX,oldZ));
        return !!before&&Math.hypot(hit.px,hit.pz)<=Math.hypot(before.px,before.pz)+1e-6;
    }
    /** Refuse a prospective body incursion before admitting the step. A
     * source-clear sidestep supplies bounded passing motion instead of a snap. */
    guardPeerStep(p, oldX, oldZ, dt = this._stepDt || 1 / 30, sidestep = false, correction = false) {
        const dx = p.x - oldX, dz = p.z - oldZ, distance = Math.hypot(dx, dz);
        if (!p.live || p.relocating || p.state === 'down' || distance < 1e-10) { this.notePeerMove(p, oldX, oldZ); return true; }
        const staticClear=this.staticWalkClear(p,p.x,p.z,oldX,oldZ);
        if(!staticClear&&!correction){
            const now=this.t.time??this._fr*(this._stepDt||1/30);
            if(p.state==='walk'&&p.e&&now>=(p._staticTurnUntil??-Infinity)){p.dir=-p.dir;p._staticTurnUntil=now+3;p.passT=.5;this.stats.staticTurns=(this.stats.staticTurns||0)+1;}
            else if(p.state==='legs'&&p.legs?.[0]?.sx!==undefined&&!p.legs[0].back){const leg=p.legs[0];leg.x=leg.sx;leg.z=leg.sz;leg.back=true;p.legs.length=1;if(p.next)p.next.dir=-p.dir;}
        }
        if (staticClear && this.peerClearStep(p, p.x, p.z, oldX, oldZ) && (!correction || this.peerCorrectionClear(p, p.x, p.z, oldX, oldZ))) { this.notePeerMove(p, oldX, oldZ); return true; }
        p.x = oldX; p.z = oldZ;
        if (sidestep) {
            const step = Math.min(1.3 * dt, distance), rx = -dz / distance, rz = dx / distance;
            for (const side of [1, -1]) {
                const x = oldX + rx * step * side, z = oldZ + rz * step * side;
                if (p.state === 'walk' && p.e) {
                    const e = p.e, u = ((x - e.a.x) * e.nx + (z - e.a.z) * e.nz) * p.side, w = roadSideWidth(e, p.side);
                    if (u < w + PED_R + 0.05 || u > w + this.width(e, p.side) - PED_R - 0.05) continue;
                }
                const physical = correction ? this.peerCorrectionClear(p, x, z, oldX, oldZ) : this.clearWalkStep(x, z, !!(p.onRoad || p.recovery));
                if (!physical || !this.peerClearStep(p, x, z, oldX, oldZ)) continue;
                p.x = x; p.z = z; p.heading = Math.atan2(oldX - x, oldZ - z); p.passT = 1.2;
                break;
            }
        }
        if (p.state === 'walk' && p.e) this.syncWalkPose(p);
        this.notePeerMove(p, oldX, oldZ);
        this.stats.peerBlocked = (this.stats.peerBlocked || 0) + 1;
        return false;
    }
    /** A separating correction may not trade a peer contact for a solid body. */
    peerCorrectionClear(p, x, z, oldX, oldZ) {
        const W = this.t.world, height = (a, b) => { const h = W.walkTop?.(a, b); return h == null ? 0.2 : h + 0.01; };
        const depth = (a, b) => { const c = collideBuildings(W.buildings || [], a, b, PED_R, height(a, b)); return c ? Math.hypot(c.px, c.pz) : 0; };
        if (this.obsDepth(x, z, PED_R) > this.obsDepth(oldX, oldZ, PED_R) + 1e-6) return false;
        if (this.inWater(x, z) || depth(x, z) > depth(oldX, oldZ) + 1e-6) return false;
        if (!p.onRoad && !this.roadAt(oldX, oldZ, PED_R) && this.roadAt(x, z, PED_R)) return false;
        let clear = true;
        if (this.t.grid?.items) this.t.grid.query(x, z, 12, v => {
            if (!clear || v.inactive || !streetLevel(v)) return;
            const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading);
            const pen = (a, b) => Math.min(v.length / 2 + PED_R - Math.abs((a - v.x) * fx + (b - v.z) * fz), v.width / 2 + PED_R - Math.abs(-(a - v.x) * fz + (b - v.z) * fx));
            const after = pen(x, z); if (after > 0 && after > pen(oldX, oldZ) + 1e-6) clear = false;
        });
        return clear;
    }
    crossingAt(node) { return (this.crossCount.get(node) || 0) > 0; }
    near(x, z, r) { const out = []; this.grid.query(x, z, r, (p) => { if (Math.hypot(p.x - x, p.z - z) < r) out.push(p); }); return out; }
    /** A road-axis side/rear yield must not prevent a physically clear body
     * from moving away from the waiting person. Preview the actual native
     * placement, including its unfinished heading/turn, without moving it. */
    vehicleStepClearsPerson(v, p, dt) {
        if (!streetLevel(v) || !v.edge || !this.t.placeOnLane) return false;
        const radius = Math.max(PED_R, this.reach(p)), fx = -Math.sin(v.heading), fz = -Math.cos(v.heading);
        if ((p.x - v.x) * fx + (p.z - v.z) * fz > v.length / 2) return false; // retain genuine front crossing yield
        const distance = (x, z, h) => { const fx = -Math.sin(h), fz = -Math.cos(h), dx = p.x - x, dz = p.z - z; return Math.max(Math.abs(dx * fx + dz * fz) - v.length / 2, Math.abs(-dx * fz + dz * fx) - v.width / 2); };
        const before = distance(v.x, v.z, v.heading); if (before <= radius + 1e-6) return false;
        dt = Math.min(.05, Math.max(1e-4, dt));
        const accel = v.tram ? 1.2 : v.bus || v.kind === 'truck' ? 1.6 : (this.t.buc ? 3 : 2.4), speed = Math.max(v.speed || 0, accel * dt);
        if (v.s + speed * dt >= v.edge.len) return false; // edge admission/advance remains the normal controller's decision
        if (!this._yieldView) {
            this._yieldView = Object.create(this.t);
            for (const key of ['_t', '_pf', '_pr', '_pc', '_pa', '_pb']) this._yieldView[key] = undefined;
            this._yieldMesh = { position: { set() {} }, rotation: { set() {} } };
            this._yieldVehicle = {};
        }
        const proposal = Object.assign(this._yieldVehicle, v); proposal.mesh = this._yieldMesh; proposal.speed = speed; proposal.s = v.s + speed * dt;
        this._yieldView.placeOnLane(proposal, false, dt);
        let previous = before;
        for (let i = 1; i <= 4; i++) {
            const f = i / 4, next = distance(v.x + (proposal.x - v.x) * f, v.z + (proposal.z - v.z) * f, angleLerp(v.heading, proposal.heading, f));
            if (next < previous - 1e-6 || next <= radius + 1e-6) return false;
            previous = next;
        }
        return previous > before + 1e-6;
    }
    /** gap from vehicle front to the nearest pedestrian on the carriageway in its path */
    obstacleGap(v, look, dt = 1 / 30) {
        let gap = Infinity; const half = v.length / 2;
        this.grid.query(v.x + v.fx * look * 0.5, v.z + v.fz * look * 0.5, look * 0.5 + 2, (p) => {
            if (!p.onRoad) return;
            const dx = p.x - v.x, dz = p.z - v.z; const f = dx * v.fx + dz * v.fz; if (f <= 0) return;
            const l = dx * v.rx + dz * v.rz; if (Math.abs(l) > v.width * 0.5 + 1.2) return;
            const g = f - half - 0.6;
            if (g < 0 && this.vehicleStepClearsPerson(v, p, dt)) return;
            if (g < gap) gap = g;
        });
        return gap;
    }
    scare(x, z, r) { for (const p of this.near(x, z, r)) if (p.state === 'wait') p.waitT += 2; }
    /** the carriageway (ground level) the point is deepest inside → { e, d, cx, cz, hw } or null (every nearby edge, not just the nearest) */
    roadAt(x, z, margin = 0.4) {
        const list = this.t.index.near(x, z, 30, this._near || (this._near = []));
        let best = null, bp = 0;
        for (const e of list) {
            if (e.tunnel || (e.ya ?? 0) > 1.5 || (e.yb ?? 0) > 1.5) continue;
            const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z, L2 = dx * dx + dz * dz || 1;
            const t = clamp(((x - e.a.x) * dx + (z - e.a.z) * dz) / L2, 0, 1);
            const cx = e.a.x + dx * t, cz = e.a.z + dz * t, d = Math.hypot(x - cx, z - cz);
            const side = (x - cx) * e.nx + (z - cz) * e.nz;
            const hw = ((this.t.world.district ? (side >= 0 ? e.wR : e.wL) : null) ?? e.halfW ?? 6) + margin;
            if (d < hw && hw - d > bp) { bp = hw - d; best = { e, d, cx, cz, hw }; }
        }
        return best;
    }
    inCarriageway(p) { return !!this.roadAt(p.x, p.z, 0.4); }
    inWater(x, z) { const w = this.t.world.isWater; if (!w) return false; return w(x, z) || w(x + 1, z) || w(x - 1, z) || w(x, z + 1) || w(x, z - 1); }
    /** keep a pedestrian that is not crossing out of every carriageway: move it to the nearest kerb */
    kerbClamp(p) {
        const ox = p.x, oz = p.z;
        let moved = false;
        for (let k = 0; k < 3; k++) {
            const r = this.roadAt(p.x, p.z, 0.7); if (!r) break;
            let nx = p.x - r.cx, nz = p.z - r.cz; const d = Math.hypot(nx, nz);
            if (d > 1e-3) { nx /= d; nz /= d; } else { nx = r.e.nx; nz = r.e.nz; }
            p.x = r.cx + nx * (r.hw + 0.3); p.z = r.cz + nz * (r.hw + 0.3); moved = true;
        }
        if (moved) this.recoverPose(p, ox, oz);
        return moved;
    }
    /**
     * Vehicles are solid for pedestrians: a step that would walk into a vehicle (OBB + margin) is refused,
     * and a vehicle that moves into a pedestrian pushes it out sideways (toward the kerb). Returns true if blocked.
     */
    avoidVehicles(p, ox, oz, moved) {
        if(!moved&&p._vehicleClearFrame===this._fr&&p._vehicleClearX===p.x&&p._vehicleClearZ===p.z)return false;
        const R = 0.3, M = 0.4; let blocked = false;
        if (p.vehiclePushFrame !== this._fr) { p.vehiclePushFrame = this._fr; p.vehiclePushLeft = 1.45 * (this._stepDt || 1 / 30); }
        const T = this.t; if (!T.grid.items) return false;
        // the box as drawn (mesh heading lags the lane direction in turns: a turning bus sweeps the corner)
        const ax = (v) => { const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading); return [fx, fz, -fz, fx]; };
        const sd = (v, a, x, z) => { const dx = x - v.x, dz = z - v.z; return Math.max(Math.abs(dx * a[0] + dz * a[1]) - v.length / 2, Math.abs(dx * a[2] + dz * a[3]) - v.width / 2); };
        if (moved) {
            T.grid.query(p.x, p.z, 10, (v) => {
                if (blocked || v.inactive || !streetLevel(v)) return;
                const a = ax(v), n = sd(v, a, p.x, p.z); if (n >= R + M) return;
                if (n < sd(v, a, ox, oz) - 1e-4) blocked = true;
            });
            if (blocked) { p.x = ox; p.z = oz; }
        }
        let pushed = false;
        for (let pass = 0; pass < 2; pass++) {
            let any = false;
            T.grid.query(p.x, p.z, 10, (v) => {
                if (v.inactive || !streetLevel(v)) return;
                const a = ax(v), dx = p.x - v.x, dz = p.z - v.z;
                const f = dx * a[0] + dz * a[1], l = dx * a[2] + dz * a[3];
                const hl = v.length / 2 + R, hw = v.width / 2 + R;
                if (Math.abs(f) >= hl || Math.abs(l) >= hw) return;
                // out sideways (away from the vehicle's centreline, i.e. toward the kerb on the side the pedestrian is on)
                const nl = (l >= 0 ? 1 : -1) * (hw + 0.05);
                const nx = v.x + a[0] * f + a[2] * nl, nz = v.z + a[1] * f + a[3] * nl;
                const dxPush = nx - p.x, dzPush = nz - p.z, distance = Math.hypot(dxPush, dzPush);
                const step = !p.live || p.relocating ? distance : Math.min(distance, p.vehiclePushLeft);
                if (step <= 0) return;
                p.x += dxPush / distance * step; p.z += dzPush / distance * step; p.vehiclePushLeft -= step; pushed = any = true;
                if (p.state === 'walk' && p.e) this.syncWalkPose(p);
            });
            if (!any) break;
        }
        if (pushed) this.stats.pushes++;
        if(!pushed&&!blocked){p._vehicleClearFrame=this._fr;p._vehicleClearX=p.x;p._vehicleClearZ=p.z;}
        return blocked;
    }
    /** a stopped / parked vehicle sits on the crossing line from the pedestrian to the far kerb */
    crossBlocked(p, leg) {
        const T = this.t; if (!T.grid.items) return false;
        const x0 = p.x, z0 = p.z, dx = leg.x - x0, dz = leg.z - z0, L = Math.hypot(dx, dz) || 1;
        let hit = false;
        T.grid.query(x0 + dx / 2, z0 + dz / 2, L / 2 + 6, (v) => {
            if (hit || v.inactive || !streetLevel(v)) return;
            for (let s = 0; s <= L; s += 0.7) {
                const x = x0 + dx * s / L - v.x, z = z0 + dz * s / L - v.z, hfx = -Math.sin(v.heading), hfz = -Math.cos(v.heading);
                if (Math.abs(x * hfx + z * hfz) < v.length / 2 + 0.5 && Math.abs(-x * hfz + z * hfx) < v.width / 2 + 0.5) { hit = true; return; }
            }
        });
        return hit;
    }
    /** knocked over by the player */
    knock(p, fx, fz, strength) {
        if (p.state === 'down') return false;
        p.prev = p.state; p.state = 'down'; p.downT = 4 + Math.min(4, strength * 0.3);
        // (2026-11-08, owner: "they teleport instead of being hit") thrown along the hit, sliding to a stop over ≈ 0.4 s
        // (was a 1.2 m jump in one frame); they get up and walk back to their sidewalk line (was a snap back onto it)
        const v0 = clamp(2.5 + strength * 0.45, 3, 9), fl = Math.hypot(fx, fz) || 1; p.flyX = fx / fl * v0; p.flyZ = fz / fl * v0;
        p.fallDir = Math.atan2(-fx, -fz);
        return true;
    }

    update(dt) {
        this.crossCount.clear();
        const T = this.t;
        this._stepDt = dt;
        this._fr = (this._fr || 0) + 1;
        this.ensurePeerGrid(true);
        for (const p of this.list) {
            this.ensurePeerGrid();
            const frameX = p.x, frameZ = p.z;
            try {
            if (p.progressX === undefined || p.relocating || p.state === 'down' || p.state === 'stand' || p.state === 'wait' || p.talkT > 0 || p.agent || p.react) {
                p.progressX = p.x; p.progressZ = p.z; p.progressT = 0;
            } else {
                p.progressT = (p.progressT || 0) + dt;
                if (p.progressT > 6) {
                    if (Math.hypot(p.x - p.progressX, p.z - p.progressZ) < 0.4) this.replanWalk(p);
                    p.progressX = p.x; p.progressZ = p.z; p.progressT = 0;
                }
            }
            if (p.recovery && p.state !== 'down') {
                const q = p.recovery, ox = p.x, oz = p.z, dx = q.x - ox, dz = q.z - oz, d = Math.hypot(dx, dz), step = Math.min(d, 1.45 * dt);
                if (d > 0.001) { p.x += dx / d * step; p.z += dz / d * step; p.heading = Math.atan2(-dx, -dz); }
                this.guardPeerStep(p, ox, oz, dt, true);
                this.clearObstacles(p); this.avoidVehicles(p, ox, oz, true);
                if (p.recovery === q && Math.hypot(q.x - p.x, q.z - p.z) < 0.08) { p.state = q.state; p.onRoad = q.onRoad; p.legs = q.legs; p.recovery = null; if (p.state === 'walk' && p.e) this.syncWalkPose(p); }
                continue;
            }
            if (p.state === 'down') {
                p.onRoad = true; // lying in the road: cars stop for them
                if (p.flyX || p.flyZ) { // thrown by the hit: slide, slowing fast; stopped by walls / props
                    const nx = p.x + p.flyX * dt, nz = p.z + p.flyZ * dt;
                    if (this.obsDepth(nx, nz) > 0) { p.flyX = p.flyZ = 0; } else { p.x = nx; p.z = nz; }
                    const k = Math.exp(-7 * dt); p.flyX *= k; p.flyZ *= k; if (Math.hypot(p.flyX, p.flyZ) < 0.1) p.flyX = p.flyZ = 0;
                }
                this.avoidVehicles(p, p.x, p.z, false); // (a car rolling onto them pushes them aside)
                p.downT -= dt;
                if (p.downT <= 0) {
                    p.onRoad = false; p.flyX = p.flyZ = 0;
                    if (p.prev === 'stand' || (!p.legs.length && !p.e)) p.state = 'stand';
                    else if (p.legs.length) p.state = 'legs';
                    else { // walk back to where their sidewalk line is, then carry on
                        const ox = p.x, oz = p.z; this.placeWalk(p); const tx = p.x, tz = p.z; p.x = ox; p.z = oz;
                        if (Math.hypot(tx - ox, tz - oz) < 0.3) p.state = 'walk';
                        else { p.legs = [{ x: tx, z: tz }]; p.next = { e: p.e, dir: p.dir, side: p.side, s: p.s }; p.state = 'legs'; p.legBest = undefined; p.legStall = 0; p.onRoad = true; } // (on their way back: cars wait, no kerb snap)
                    }
                }
                continue;
            }
            if (p.agent || p.react) { this.updateActor(p, dt); continue; } // reacting to the player's parked car / the officer
            if (p.talkT > 0) { // in a conversation with the walker (E to talk): stands, faces them, gestures
                p.talkT -= dt; p.talkWave = (p.talkWave || 0) - dt; const W = p.talkTo; if (W) p.heading = Math.atan2(-(W.x - p.x), -(W.z - p.z));
                if (p.talkT <= 0) { p.talkTo = null; if (p.state === 'walk' && p.e) this.placeWalk(p); }
                continue;
            }
            const ox = p.x, oz = p.z, os = p.s;
            let moved = false;
            if (p.state === 'stand') { /* waits at the stop */ }
            else if (p.state === 'walk') {
                if (!p.e) { p.state = 'stand'; continue; }
                p.s += p.speed * dt * p.dir;
                if (p.walkGoal !== undefined) { const d = p.walkGoal - (p.walkOff || 0), k = Math.min(Math.abs(d), 1.3 * dt); p.walkOff = (p.walkOff || 0) + Math.sign(d) * k; if (Math.abs(d) < 0.02) p.walkGoal = undefined; }
                else if (p.walkOff && !(p.passT > 0)) { const k = Math.min(Math.abs(p.walkOff), 0.35 * dt); p.walkOff -= Math.sign(p.walkOff) * k; } // drift back to the sidewalk line
                const e = p.e;
                const endNode = p.dir > 0 ? e.b : e.a;
                const ins = Math.min(this.inset(endNode), e.len * 0.45);
                const sEnd = p.dir > 0 ? e.len - ins : ins;
                if ((p.dir > 0 && p.s >= sEnd) || (p.dir < 0 && p.s <= sEnd)) {
                    p.s = sEnd; this.placeWalk(p);
                    if (this.guardPeerStep(p, ox, oz, dt, true)) this.planNode(p, endNode);
                } else { this.placeWalk(p); this.guardPeerStep(p, ox, oz, dt, true); }
                p.onRoad = false; moved = true;
            } else if (p.state === 'legs' || p.state === 'wait') {
                const leg = p.legs[0];
                if (!leg) { p.state = 'walk'; continue; }
                if (leg.cross && !leg.started) {
                    p.state = 'wait'; p.waitT += dt;
                    if (p.waitT > 60) { if (this.replanWalk(p)) { p.waitT = 0; continue; } p.waitT = 45; } // a blocked crossing is not a permanent destination
                    // (a full queue at this kerb — six already waiting: a crowd piled up at one corner): walk on instead
                    if (!leg.slot && this.list.filter(o => o !== p && o.state === 'wait' && Math.abs(o.x - p.x) < 3.5 && Math.abs(o.z - p.z) < 3.5).length >= 6) {
                        const e0 = p.e, s0 = clamp(p.s, 0, e0.len), o0 = this.off(e0, p.side) * p.side; // (walk back to the sidewalk they came along)
                        p.legs = [{ x: e0.a.x + e0.dirx * s0 + e0.nx * o0, z: e0.a.z + e0.dirz * s0 + e0.nz * o0 }]; p.next = { e: e0, dir: -p.dir, side: p.side, s: s0 };
                        p.state = 'legs'; p.waitT = 0; p.legBest = undefined; p.legStall = 0; continue;
                    }
                    if (!leg.slot) this.waitSlot(p, leg);
                    if (this.safeToCross(leg, p.waitT, p)) {
                        p.shuffle = false; leg.started = true; leg.sx = p.x; leg.sz = p.z; leg.len = Math.hypot(leg.x - p.x, leg.z - p.z); p.state = 'legs'; p.waitT = 0; p.crossT = 0;
                    } else {
                        // step to the queue spot (a few small steps, walking animation)
                        const sl = leg.slot, sx = sl.x - p.x, sz = sl.z - p.z, sd = Math.hypot(sx, sz);
                        if (sd > 0.08 && p.waitT > 3) { sl.x = p.x; sl.z = p.z; } // (someone stands in the way: wait here)
                        p.shuffle = sd > 0.08 && p.waitT <= 3; if (p.shuffle) { const k = Math.min(sd, 0.9 * dt) / sd; p.x += sx * k; p.z += sz * k; this.guardPeerStep(p, ox, oz, dt, true); }
                        p.heading = Math.atan2(-(leg.x - p.x), -(leg.z - p.z));
                        // waiting at the kerb: never in a carriageway (a push by a car, a corner inside another road)
                        if ((p.i + this._fr) % 30 === 0) this.kerbClamp(p);
                        this.clearObstacles(p); // (a pole / sign at the corner)
                        this.avoidVehicles(p, ox, oz, false); // (last: nobody ends the frame inside a car)
                        continue;
                    }
                }
                const dx = leg.x - p.x, dz = leg.z - p.z; const d = Math.hypot(dx, dz);
                const sp = p.speed * (leg.cross ? 1.25 : 1);
                p.onRoad = !!leg.cross;
                if (leg.cross) this.crossCount.set(leg.node, (this.crossCount.get(leg.node) || 0) + 1);
                // (2026-11-08, owner: "stuck people randomly") a turning point that cannot be reached (the kerb clamp / an
                // obstacle pushes the walker back every frame: walking on the spot in a clump): no headway for 2.5 s → skip it
                if (!leg.cross) { if (p.legBest === undefined || d < p.legBest - 0.15) { p.legBest = d; p.legStall = 0; } else p.legStall = (p.legStall || 0) + dt; }
                const stalled = !leg.cross && p.legStall > 2.5;
                if (d < sp * dt + 0.05 || stalled) {
                    let reached = true;
                    if (!stalled) { p.x = leg.x; p.z = leg.z; reached = this.guardPeerStep(p, ox, oz, dt, true); }
                    if (reached) {
                        p.legs.shift(); p.legBest = undefined; p.legStall = 0;
                        if (!p.legs.length) { const qx = p.x, qz = p.z; p.state = 'walk'; p.onRoad = false; p.e = p.next.e; p.dir = p.next.dir; p.side = p.next.side; p.s = p.next.s; this.placeWalk(p); this.adoptLine(p, qx, qz); }
                    }
                } else {
                    p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; p.heading = Math.atan2(-dx, -dz);
                    this.guardPeerStep(p, ox, oz, dt, true);
                }
                moved = true;
            }
            // never loiter in a carriageway (except while crossing): checked a few peds per frame
            if (!p.onRoad && (p.i + this._fr) % 30 === 0) {
                if (p.state !== 'walk') this.kerbClamp(p);
                else if (!p.onDodge && this.inCarriageway(p)) {
                    // the sidewalk line runs through another road here: turn back, then switch sides / move away
                    p.roadHits = (p.roadHits || 0) + 1;
                    if (p.roadHits === 1) { p.dir = -p.dir; p.s = os; }
                    else if (p.roadHits === 2 && this.width(p.e, -p.side) > 0) { const x = p.x, z = p.z; p.side = -p.side; this.placeWalk(p); this.recoverPose(p, x, z); }
                    else { p.roadHits = 0; if (T.large) this.relocate(p, 120, 420, true); else this.relocate(p, 30, 200, true); } // (standing them at the kerb piled them up on one spot)
                } else p.roadHits = 0;
                // never in water / a fountain basin (+ 1 m rim; world-visual request, note 17): walkers cross to the other
                // sidewalk, anyone else is moved back onto a sidewalk around the player
                if (this.inWater(p.x, p.z)) {
                    if (p.state === 'walk' && !p.wetFlip && this.width(p.e, -p.side) > 0) { const x = p.x, z = p.z; p.wetFlip = true; p.side = -p.side; this.placeWalk(p); this.recoverPose(p, x, z); }
                    else { p.wetFlip = false; this.relocate(p, 30, 200, true); }
                    this.stats.wet = (this.stats.wet || 0) + 1;
                } else if (p.wetFlip && (p.i + this._fr) % 300 === 0) p.wetFlip = false;
            }
            // static obstacles (trees, lamps, poles, bins, signs, shelters, lot cars): never inside one (note 38) — walkers
            // already detour around them on their sidewalk line (dodgeAt); this catches corners, crossings and stops
            if (this.clearObstacles(p) && p.state === 'legs') {
                const lg = p.legs[0]; // its corner point is taken by an obstacle: close enough is reached
                if (lg && !lg.cross && Math.hypot(lg.x - p.x, lg.z - p.z) < 1.2) { lg.x = p.x; lg.z = p.z; }
            }
            // vehicles are obstacles (never overlap); a walker blocked for long turns back
            // Keep refusing steps deeper into a stopped body while the crossing
            // timeout prepares its smooth return. Penetration-reducing escape
            // remains allowed by avoidVehicles' previous-pose comparison.
            if (this.avoidVehicles(p, ox, oz, moved)) {
                if (p.state === 'walk') p.s = os;
                p.blockT = (p.blockT || 0) + dt;
                if (p.blockT > 3 && p.state === 'walk') { p.dir = -p.dir; p.blockT = 0; p.heading += Math.PI; }
            } else p.blockT = Math.max(0, (p.blockT || 0) - dt);
            // a crossing that makes no headway (a car parked across it, a queue on the zebra): give up and walk back to the
            // kerb it started from, then carry on along the sidewalk it came from — cars waiting for them can go
            if (p.onRoad && p.state === 'legs') {
                const leg = p.legs[0];
                p.crossT = (p.crossT || 0) + dt;
                // pinned between cars on the carriageway (they wait for the pedestrian, the pedestrian for them): step through
                // (2026-11-08: was a jump onto the leg's end — "they teleport") a crossing turns back now; any other leg is
                // dropped and they carry on from where they stand
                if (leg && (p.blockT || 0) > 4) {
                    p.blockT = 0;
                    if (leg.cross && leg.sx !== undefined && !leg.back) { leg.back = true; leg.x = leg.sx; leg.z = leg.sz; p.legs.length = 1; p.next = { e: p.e, dir: -p.dir, side: p.side, s: p.s }; }
                    else if (!leg.cross) { p.legs.shift(); if (!p.legs.length && p.next) { const qx = p.x, qz = p.z; p.state = 'walk'; p.onRoad = false; p.e = p.next.e; p.dir = p.next.dir; p.side = p.next.side; p.s = p.next.s; this.placeWalk(p); this.adoptLine(p, qx, qz); } }
                }
                if (leg && leg.cross && leg.sx !== undefined && p.crossT > 5 + (leg.len || 10) / 1.2 && !leg.back) {
                    leg.back = true; leg.x = leg.sx; leg.z = leg.sz; p.blockT = 0;
                    p.legs.length = 1; p.next = { e: p.e, dir: -p.dir, side: p.side, s: p.s };
                }
            }
            } finally { this.guardPeerStep(p, frameX, frameZ, dt); }
        }
        this.ensurePeerGrid(true);
        this.separate(dt);
        // Crowd separation also changes the physical pose. A sidestep must not
        // finish inside a pole/car that was cleared earlier in this update.
        for (const p of this.list) if (p.state !== 'down') {
            this.ensurePeerGrid(); const x = p.x, z = p.z;
            this.avoidVehicles(p, p.x, p.z, false); this.clearObstacles(p); this.guardPeerStep(p, x, z, dt);
        }
        this.ensurePeerGrid();
        if (this._fr % 15 === 0) this.countObstacleOverlaps();
        this.writeMatrices(dt);
    }
    /**
     * People never stand inside each other (two bodies in one spot z-fight into flickering patches): overlapping pairs
     * are pushed apart. Walkers sidestep through their sidewalk offset (walkOff, so placeWalk keeps it; head-on they
     * pass on their right), anyone else is moved directly; someone talking to the walker / an officer / a reacting
     * passer-by holds their spot and the other one makes room.
     */
    separate(dt = 1 / 30) {
        const grid = this.grid, C = this.crowd;
        // (each person's own reach: the umbrella canopies of two passers-by no longer cut through each other)
        if (this._fr % 30 === 0 || !this._reachOk) { for (const p of this.list) p.reach = C.reach ? C.reach(p.i) : PED_R; this._reachOk = true; }
        const fixed = (p) => p.talkT > 0 || !!p.agent || !!p.react;
        for (const p of this.list) { p._ov = 0; p.sepLeft = 1.3 * dt; if (p.passT > 0) p.passT -= dt; }
        for (const p of this.list) {
            if (p.state === 'down') continue;
            this.ensurePeerGrid();
            grid.query(p.x, p.z, 1.1, (q) => {
                if (q.i <= p.i || q.state === 'down') return;
                const D = (p.reach || PED_R) + (q.reach || PED_R);
                let dx = q.x - p.x, dz = q.z - p.z; const d = Math.hypot(dx, dz); if (d >= D) return;
                if (d < 1e-3) { const a = (p.i * 2.399) % 6.283; dx = Math.cos(a); dz = Math.sin(a); } else { dx /= d; dz /= d; }
                const fp = fixed(p), fq = fixed(q); if (fp && fq) return;
                const ov = D - d, kp = fq ? 1 : fp ? 0 : 0.5, kq = 1 - kp;
                if (ov > 0.15 + (D - PED_R * 2) * 0.5) { p._ov = Math.max(p._ov, ov); q._ov = Math.max(q._ov, ov); } // (a canopy brushing past is not a pile)
                this.sepPush(p, -dx * ov * kp, -dz * ov * kp, q);
                this.sepPush(q, dx * ov * kq, dz * ov * kq, p);
            });
        }
        // (2026-11-08, owner: "people still get stuck in each other ... they eventually respawn/despawn but it looks bad")
        // still inside someone after 2 s (pinned between a facade and the kerb, a pile at a corner): walkers step past on the
        // other sidewalk line, anyone else steps to the nearest free spot; after 8 s and out of the player's sight, moved
        // elsewhere (a last resort: a person vanishing in view looks worse than a short overlap)
        const P = this.t.player;
        for (const p of this.list) {
            if (p.state === 'down') continue;
            if (!p._ov) { p.ovT = Math.max(0, (p.ovT || 0) - dt * 2); if (p.ovT < 0.5) p.unpiled = false; continue; }
            p.ovT = (p.ovT || 0) + dt;
            if (p.ovT > 2 && !p.unpiled && !fixed(p)) {
                p.unpiled = true;
                if (p.state === 'walk' && p.e) { p.walkGoal = (p.walkOff || 0) > 0.4 ? 0 : Math.min(0.8, this.maxOut(p.e, p.side)); p.passT = 2.5; } // (steps across over ≈ 0.6 s, no jump)
                else this.unpile(p, 1.2);
            }
            if (p.ovT > 8 && P && !fixed(p)) {
                const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
                if (d > 70 || (d > 25 && dx * (P.fx || 0) + dz * (P.fz || 0) < 0)) {
                    p.ovT = 0; p.unpiled = false; this.relocate(p, this.t.large ? 120 : 30, this.t.large ? 420 : 200, true);
                    this.t.stats.pedUnclump = (this.t.stats.pedUnclump || 0) + 1;
                }
            }
        }
    }
    /**
     * (2026-11-08, owner: a dozen walkers piled into one spot at a corner) everyone waiting to cross used to stand on the
     * same kerb point: each gets a free spot of a small queue grid there (along the kerb, then rows back from it), ≥ 0.7 m
     * from the others, and crosses on a parallel line (the far end shifted by the same amount along the kerb)
     */
    waitSlot(p, leg) {
        const cx = leg.x - p.x, cz = leg.z - p.z, cl = Math.hypot(cx, cz) || 1, ux = cx / cl, uz = cz / cl, tx = -uz, tz = ux;
        const LAT = [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4], BACK = [0, 0.75, 1.5, 2.25];
        let pick = null;
        for (const b of BACK) {
            for (const l of LAT) {
                const x = p.x + tx * l - ux * b, z = p.z + tz * l - uz * b;
                if (this.list.some(o => o !== p && o.state !== 'down' && Math.hypot((o.state === 'wait' && o.legs[0]?.slot ? o.legs[0].slot.x : o.x) - x, (o.state === 'wait' && o.legs[0]?.slot ? o.legs[0].slot.z : o.z) - z) < 0.7 && Math.abs(o.x - x) < 3 && Math.abs(o.z - z) < 3)) continue;
                if (this.roadAt(x, z, 0.35) || this.obsDepth(x, z) > 0 || this.inWater(x, z)) continue;
                pick = { x, z, l }; break;
            }
            if (pick) break;
        }
        leg.slot = pick || { x: p.x, z: p.z, l: 0 };
        if (leg.slot.l) { // cross on a parallel line: the far end moves along the kerb by the same amount
            const q = { x: leg.x + tx * leg.slot.l, z: leg.z + tz * leg.slot.l };
            if (!this.roadAt(q.x, q.z, 0.35) && !(this.obsDepth(q.x, q.z) > 0)) { leg.x = q.x; leg.z = q.z; }
        }
    }
    /** the free spot nearest to p (>= 0.7 m from everyone, off the carriageway, clear of obstacles) within r; moves p there */
    unpile(p, r) {
        let best = null;
        for (let ring = 1; ring <= 3 && !best; ring++) {
            const rr = r * ring / 3, n = 6 + ring * 2;
            for (let k = 0; k < n; k++) {
                const a = (k / n + p.i * 0.137) * 6.2832, x = p.x + Math.cos(a) * rr, z = p.z + Math.sin(a) * rr;
                if (this.near(x, z, 0.7).some(o => o !== p)) continue;
                if (this.roadAt(x, z, 0.4) || this.obsDepth(x, z) > 0 || this.inWater(x, z)) continue;
                best = { x, z }; break;
            }
        }
        if (best) { const x = p.x, z = p.z; p.x = best.x; p.z = best.z; this.recoverPose(p, x, z); }
        return !!best;
    }
    sepPush(p, px, pz, other) {
        if (!px && !pz) return;
        const oldX = p.x, oldZ = p.z;
        const push = Math.hypot(px, pz), step = Math.min(push, p.sepLeft ?? 1.3 / 30);
        if (step <= 0) return;
        px *= step / push; pz *= step / push; p.sepLeft = Math.max(0, (p.sepLeft ?? 1.3 / 30) - step);
        if (p.state === 'walk' && p.e) {
            const e = p.e, k = Math.hypot(px, pz);
            let o = (px * e.nx + pz * e.nz) * p.side; // lateral share, in walkOff units (+ = away from the road)
            const head = other.state === 'walk' && other.e === e && other.dir !== p.dir;
            if (Math.abs(o) < k * 0.5) { // (mostly along the line: one behind / in front of the other) → step aside
                // (the two always step to opposite sides: chosen by index parity both often went the same way and stayed
                // inside each other)
                const right = p.side * p.dir > 0 ? 1 : -1; // walking on the road's right: their right is away from the road
                const lat = ((other.x - p.x) * e.nx + (other.z - p.z) * e.nz) * p.side; // where the other one is, across the line
                o = k * (head ? right : Math.abs(lat) > 0.04 ? -Math.sign(lat) : (p.i < other.i ? 1 : -1));
                // the one behind (same way) also holds back: nobody walks through the one in front
                if (!head) p.s += px * e.dirx + pz * e.dirz;
            }
            const before = p.walkOff || 0, hi = Math.max(-0.6, Math.min(3, this.maxOut(e, p.side)));
            p.walkOff = clamp(before + o, -0.6, hi);
            // no room on that side (the facade / the kerb): step the other way past them instead
            if (Math.abs(p.walkOff - before) < Math.abs(o) * 0.3) p.walkOff = clamp(before - o, -0.6, hi);
            p.passT = 1.2; // (no drifting back onto the line while passing)
            this.placeWalk(p);
        } else { p.x += px; p.z += pz; }
        if (p.live && !this.peerCorrectionClear(p, p.x, p.z, oldX, oldZ)) { p.x = oldX; p.z = oldZ; if (p.state === 'walk' && p.e) this.syncWalkPose(p); }
        this.guardPeerStep(p, oldX, oldZ, this._stepDt || 1 / 30);
    }

    /** a pedestrian busy with the player's parked car: an officer walking up / standing by it, a passer-by reacting */
    updateActor(p, dt) {
        const a = p.agent;
        if (a) {
            const dx = a.x - p.x, dz = a.z - p.z, d = Math.hypot(dx, dz);
            if (d > 0.15) { const sp = Math.min(d, 1.45 * dt); p.x += dx / d * sp; p.z += dz / d * sp; p.heading = Math.atan2(-dx, -dz); p.moving = true; }
            else { if (!a.arrived) { a.arrived = true; try { a.onArrive?.(); } catch { /* ignore */ } } p.moving = false; p.heading = Math.atan2(-(a.fx - p.x), -(a.fz - p.z)); }
            p.pose = p.moving ? 0 : a.pose || 0; p.prop = p.moving ? null : a.prop || null;
            if (((p.i + this._fr) & 7) === 0) p.onRoad = this.inCarriageway(p); // (cars stop for an officer stepping into the lane)
            if (d > 1) this.clearObstacles(p);
            this.avoidVehicles(p, p.x, p.z, false);
            return;
        }
        const r = p.react; r.t -= dt; p.moving = false;
        p.heading = Math.atan2(-(r.x - p.x), -(r.z - p.z)); p.pose = r.pose || 0; p.prop = r.prop || null;
        if (r.t <= 0) { p.react = null; p.pose = 0; p.prop = null; }
        this.avoidVehicles(p, p.x, p.z, false);
    }

    planNode(p, node) {
        const e = p.e; const fx = e.dirx * p.dir, fz = e.dirz * p.dir;
        const ts = p.side * p.dir; // +1 = walking on the right of the road relative to travel
        const opts = [];
        for (const g of node.edges) {
            if (g === e || !this.ok(g)) continue;
            const og = g.a === node ? 1 : -1;
            const gx = g.dirx * og, gz = g.dirz * og;
            opts.push({ g, og, ang: turnAngle(fx, fz, gx, gz), dot: fx * gx + fz * gz });
        }
        const here = { x: p.x, z: p.z };
        const goWalk = (g, og, fromPt, legs) => {
            const d0 = Math.min(this.inset(node), g.len * 0.45);
            const A = this.sidePoint(g, node, d0, 1), B = this.sidePoint(g, node, d0, -1);
            const useA = Math.hypot(A.x - fromPt.x, A.z - fromPt.z) <= Math.hypot(B.x - fromPt.x, B.z - fromPt.z);
            const P2 = useA ? A : B;
            legs.push({ x: P2.x, z: P2.z });
            // every kerb point of the plan (corner, crossing ends, next sidewalk) outside all carriageways: at
            // tight / skewed junctions a sidewalk-line point can fall inside another road
            // (2026-11-08) everyone turning at a corner aimed at the same point and piled up round it: each walker aims at
            // their own point within ~0.5 m of it (the crossing end gets its queue spot / parallel line in waitSlot)
            const dS = (this.rng() - 0.5) * 1.2, s2 = clamp(P2.s + dS, 0, g.len); legs[legs.length - 1].x += g.dirx * (s2 - P2.s); legs[legs.length - 1].z += g.dirz * (s2 - P2.s); P2.s = s2; // (the last point slides along the line only: no snap onto it)
            for (let k = 0; k < legs.length - 1; k++) if (!legs[k].cross) { const L = legs[k], a = (p.i * 2.399 + this.rng() * 1.5) % 6.2832, r = 0.15 + this.rng() * 0.4; L.x += Math.cos(a) * r; L.z += Math.sin(a) * r; }
            for (const L of legs) { const q = { x: L.x, z: L.z }; if (this.kerbClamp(q)) { L.x = q.x; L.z = q.z; } if (this.obsClamp(q)) { L.x = q.x; L.z = q.z; } }

            p.legs = legs; p.state = 'legs'; p.next = { e: g, dir: og, side: useA ? 1 : -1, s: P2.s };
        };
        const crossLeg = (X, legs, from) => {
            if (this.width(X, 1) <= 0 || this.width(X, -1) <= 0) return null;
            const cd = Math.min(this.inset(node) + 1.5, X.len * 0.45);
            const A = this.sidePoint(X, node, cd, 1), B = this.sidePoint(X, node, cd, -1);
            const near = Math.hypot(A.x - from.x, A.z - from.z) <= Math.hypot(B.x - from.x, B.z - from.z) ? [A, B] : [B, A];
            legs.push({ x: near[0].x, z: near[0].z });
            legs.push({ x: near[1].x, z: near[1].z, cross: true, node, edge: X });
            return near[1];
        };
        if (!opts.length) { // dead end: turn around (maybe crossing)
            p.dir = -p.dir; this.placeWalk(p); return;
        }
        // Retain the normal corner / straight / crossing routes, but choose
        // among their free destination corridors rather than feeding a full loop.
        const routes = [];
        const route = (o, cross, weight) => {
            if (!(weight > 0)) return;
            const legs = [], from = cross ? crossLeg(cross, legs, here) : here;
            if (!from) return;
            const d = Math.min(this.inset(node), o.g.len * 0.45), A = this.sidePoint(o.g, node, d, 1), B = this.sidePoint(o.g, node, d, -1);
            const side = Math.hypot(A.x - from.x, A.z - from.z) <= Math.hypot(B.x - from.x, B.z - from.z) ? 1 : -1;
            const capacity = this.walkSpace(o.g, side).cells.length, load = this.spaceLoad(o.g, side, p);
            weight *= capacity ? Math.max(0, 1 - load / capacity) ** 2 : 0;
            if (weight > 0) routes.push({ o, from, legs, weight });
        };
        if (opts.length === 1) {
            route(opts[0], null, node.crossing ? 0.6 : 1);
            if (node.crossing) route(opts[0], e, 0.4);
        } else {
            opts.sort((a, b) => a.ang - b.ang); // left .. right
            const corner = ts > 0 ? opts[opts.length - 1] : opts[0], far = ts > 0 ? opts[0] : opts[opts.length - 1];
            const straight = opts.reduce((a, b) => b.dot > a.dot ? b : a), signal = node.hasLight || node.crossing;
            const turnWeight = !signal && !T_BUC(this) ? 0.8 : 0.45, straightWeight = straight !== corner && straight.dot > 0.5 ? Math.max(0, 0.75 - turnWeight) : 0;
            route(corner, null, turnWeight);
            route(straight, corner.g, straightWeight);
            route(far, e, 1 - turnWeight - straightWeight);
        }
        let n = this.rng() * routes.reduce((sum, q) => sum + q.weight, 0), selected = null;
        for (const q of routes) { n -= q.weight; if (n <= 0) { selected = q; break; } }
        if (selected) goWalk(selected.o.g, selected.o.og, selected.from, selected.legs);
        else { p.dir = -p.dir; this.syncWalkPose(p); p.legs = []; p.next = null; p.state = 'walk'; } // walk back at the same physical pose

    }

    safeToCross(leg, waited, p) {
        const T = this.t; const node = leg.node, X = leg.edge;
        if (p && this.crossBlocked(p, leg)) return false; // a car is standing on the crossing
        if (node.hasLight) {
            if (T.lightState(node, X) === 'red') return this.noFastCar(leg, 6);
            return T.buc && waited > 25 && this.noFastCar(leg, 30);
        }
        if (waited > (T.buc ? 14 : 30)) return this.noFastCar(leg, 8);
        return this.noFastCar(leg, node.crossing ? 16 : 26);
    }
    noFastCar(leg, r) {
        const mx = leg.x, mz = leg.z; let ok = true;
        this.t.grid.query(mx, mz, r, (v) => {
            if (!ok || v.parked) return;
            const dx = mx - v.x, dz = mz - v.z; const d = Math.hypot(dx, dz);
            if (d < r && v.speed > 1.5 && (dx * v.fx + dz * v.fz) > -2) ok = false;
            if (d < 5) ok = false;
        });
        const P = this.t.player;
        if (P) { const dx = mx - P.x, dz = mz - P.z; const d = Math.hypot(dx, dz); if (d < r && Math.abs(P.speed) > 2 && (dx * P.fx + dz * P.fz) > -2) ok = false; }
        return ok;
    }

    writeMatrices(dt = 0) {
        const C = this.crowd;
        const wx = this.t.weatherKind ?? globalThis.game?.wxKind; if (wx !== undefined && wx !== C.weather) C.setWeather(wx);
        // feet on the raised sidewalk where the district has one (world.walkTop, 2026-11-08), else the legacy 0.2 m;
        // re-sampled when the walker has moved ≥ 0.5 m
        const wt = this.t.world?.walkTop;
        const footY = (p) => { if (!wt) return 0.2; if (p._fyx === undefined || Math.abs(p.x - p._fyx) + Math.abs(p.z - p._fyz) > 0.5) { const h = wt(p.x, p.z); p._fy = h === null ? 0.2 : h + 0.01; p._fyx = p.x; p._fyz = p.z; } return p._fy; };
        for (const p of this.list) {
            const s = p.scale;
            if (p.state === 'down') { C.set(p.i, { x: p.x, y: footY(p), z: p.z, scale: s, down: true, fallDir: p.fallDir }); continue; }
            const k = dt > 0 ? 1 - Math.exp(-8 * dt) : 1;
            const vx = dt > 0 && p.animX !== undefined ? (p.x - p.animX) / dt : 0, vz = dt > 0 && p.animZ !== undefined ? (p.z - p.animZ) / dt : 0;
            p.animVX = (p.animVX || 0) + (vx - (p.animVX || 0)) * k; p.animVZ = (p.animVZ || 0) + (vz - (p.animVZ || 0)) * k;
            p.animX = p.x; p.animZ = p.z;
            const talking = p.talkT > 0, speed = Math.hypot(p.animVX, p.animVZ), amp = talking || speed < 0.12 ? 0 : Math.min(1, speed / p.speed), moving = amp > 0;
            p.phase += Math.min(speed, p.speed * 1.25) * dt * 5.5;
            const bob = moving ? Math.abs(Math.sin(p.phase)) * 0.03 * amp : 0;
            C.set(p.i, { x: p.x, y: footY(p) + bob, z: p.z, yaw: p.heading, phase: p.phase, amp, scale: s, pose: talking ? (p.talkWave > 0 ? 4 : 7) : moving ? 0 : (p.pose || 0), prop: moving || talking ? null : (p.prop || null) });
        }
    }
    dispose() { this.crowd.dispose(); }
}
const T_BUC = (peds) => peds.t.buc;

// ============================================================================
//  ILLEGAL-PARKING LINES (note 8). Bucharest: Romanian with the English translation (research/bucharest-spots.json
//  dialogue_general: locals grumble about sidewalk parking, honking and buses — good-humoured, never aggressive; the
//  three sidewalk lines are quoted from pedestrian_general.sidewalk_parking). Seattle / Bellevue: polite,
//  passive-aggressive remarks, little honking (research/seattle-spots.json: "Nobody honks around here — we wave").
// ============================================================================
const RL = (t, en) => ({ t, en });
const PARK_RO = {
    remark: [RL('Ts-ts-ts… parcat ca un șmecher.', 'Tsk tsk… parked like a big shot.'), RL('Ce tupeu!', 'The nerve!'), RL('Avariile = parcare gratuită, nu?', 'Hazard lights = free parking, right?'),
        RL('Las’ că vine Poliția Locală.', 'Just wait, the local police are coming.'), RL('Unde parchezi, pe capota mea?', 'Where are you parking, on my bonnet?'), RL('„Doar cinci minute”, sigur…', '"Just five minutes", sure…')],
    reason: {
        zebra: [RL('Pe trecere, domnule? Serios?', 'On the zebra crossing, sir? Seriously?'), RL('Pe unde trec acum, prin portbagaj?', 'How do I cross now, through the boot?')],
        junction: [RL('În mijlocul intersecției… bravo!', 'In the middle of the junction… well done!')],
        tram: [RL('Acum stă tramvaiul din cauza lui.', 'Now the tram is stuck because of him.'), RL('Pe șine?! Vine tramvaiul!', 'On the tracks?! The tram is coming!')],
        busstop: [RL('În stație?! Unde oprește autobuzul?', 'In the bus stop?! Where is the bus supposed to stop?')],
        buslane: [RL('Pe banda de autobuz, normal.', 'In the bus lane, of course.')],
        lane: [RL('A lăsat-o pe bandă, cu avariile, și dus a fost.', 'Left it in the lane with the hazards on and off he went.')],
        driveway: [RL('A blocat poarta. Cum mai ies eu acum?', 'He blocked the gate. How do I get out now?')],
        sidewalk: [RL('Iar mașini parcate pe trotuar...', 'Cars parked on the sidewalk again...'), RL('Pe unde să trec cu căruciorul?', 'Where am I supposed to pass with the stroller?')],
    },
    photo: [RL('Stai să-i fac o poză.', 'Hang on, let me take a picture.'), RL('Poză pentru grupul cartierului de pe Facebook.', 'A photo for the neighbourhood Facebook group.')],
    call: [RL('Alo, Poliția Locală? Avem una parcată {where}.', 'Hello, local police? There\'s one parked {where}.'), RL('Sun la Poliția Locală, gata.', 'I\'m calling the local police, that\'s it.')],
    where: { zebra: RL('pe trecere', 'on the crossing'), junction: RL('în intersecție', 'in the junction'), tram: RL('pe șine', 'on the tram tracks'), busstop: RL('în stație', 'in the bus stop'), buslane: RL('pe banda de autobuz', 'in the bus lane'), lane: RL('pe bandă', 'in the traffic lane'), driveway: RL('în fața porții', 'in front of a gate'), sidewalk: RL('pe trotuar', 'on the sidewalk') },
    driver: [RL('Hai, mă, mută mașina!', 'Come on, move the car!'), RL('Cine a lăsat-o aici?!', 'Who left this here?!'), RL('Ăsta-i parcat, nu? Super.', 'He\'s parked, isn\'t he? Great.')],
    officer: [RL('Poliția Locală. Ce avem aici…', 'Local police. What do we have here…')],
    ticket: [RL('Proces-verbal. Amendă pe parbriz.', 'Official report. The fine is on the windscreen.')],
    clamp: [RL('Proces-verbal și sabot pe roată.', 'A fine and a clamp on the wheel.')],
    truck: [RL('Ridicare auto! Facem loc.', 'Tow-away! Clearing the way.')],
    tow: [RL('O ridicăm. O găsiți la depozit.', 'We\'re lifting it. You\'ll find it at the pound.')],
};
const PARK_US = {
    remark: [RL('Wow. Okay.'), RL('Must be nice.'), RL('I\'m sure they\'ll be right back…'), RL('Interesting parking choice.'), RL('Some people, huh.'), RL('Hazards on doesn\'t make it a parking spot.')],
    reason: {
        zebra: [RL('That\'s… a crosswalk.'), RL('Guess I\'ll just walk around it. Into traffic.')],
        junction: [RL('In the intersection. Bold.')],
        busstop: [RL('The bus has to stop somewhere, you know.')],
        buslane: [RL('Pretty sure that\'s a bus lane.')],
        hydrant: [RL('Hope there\'s no fire today.'), RL('That\'s a hydrant, friend.')],
        lane: [RL('Just… in the lane. Cool.')],
        driveway: [RL('Pretty sure that\'s someone\'s driveway.')],
        sidewalk: [RL('I\'ll just walk in the street, then.'), RL('Strollers and wheelchairs use this, but sure.')],
        tram: [RL('On the tracks? Really?')],
    },
    photo: [RL('Getting a picture of this.'), RL('Snapping this for the city.')],
    note: [RL('Leaving them a little note. 🙂'), RL('A polite note. Very polite.')],
    call: [RL('Hi, yes — reporting a car parked {where}.'), RL('I\'ll call parking enforcement.')],
    where: { zebra: RL('in a crosswalk'), junction: RL('in an intersection'), tram: RL('on the tracks'), busstop: RL('in a bus zone'), buslane: RL('in the bus lane'), lane: RL('in a travel lane'), driveway: RL('across a driveway'), sidewalk: RL('on the sidewalk'), hydrant: RL('at a fire hydrant') },
    driver: [RL('Seriously?'), RL('Are they just… gone?'), RL('Okay, going around.')],
    officer: [RL('Parking Enforcement. Let\'s take a look.')],
    ticket: [RL('Citation\'s on the windshield.')],
    clamp: [RL('Citation\'s on the windshield.')],
    truck: [RL('Tow truck. This one\'s blocking traffic.')],
    tow: [RL('Hooking it up — it\'ll be at the impound lot.')],
};
