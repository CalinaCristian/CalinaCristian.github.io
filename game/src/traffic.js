import * as THREE from '../vendor/three.module.min.js';
import * as VEH from './vehicles.js';
import { TrafficDialogue } from './situational-dialogue-traffic.js';
import { makeRng, clamp } from './util.js';
import { EdgeIndex, nodeList, isMotorway, lanesDir, canTravel, edgeSpeed } from './nav.js';
import { assignSignalPhases, signalState } from './signals.js';
import { SharedLaneGate } from './shared-lanes.js';
import { admitInitialTraffic, initialBodyCover, previewInitialTrafficPose, initialTrafficStaticClearance } from './initial-traffic-admission.js';
import { sampleTramPath, buildTramNetwork, nearestTramSource, canTravelTram, projectTramStations, tramSectionPoses } from './tram-path.js';
import { buildTurnLaneRules } from './turn-lanes.js';
import { buildMotorTurnRestrictions } from './motor-turn-restrictions.js';
import { buildTramSourceSignals, tramSourceSignalState } from './tram-source-signals.js';
import { mixin } from './mixin.js';
import { DISTRICT_LOD_VEHICLE_FAR_M, DISTRICT_LOD_VEHICLE_M, Grid, HOUR_PROFILE, RECOVERY_VIEW_FAR_M, actorCanTravel, bandOf, closedEdge, hourDensity, isJunction, junctionDist, laneOffset, layerOf, lodStride, trafficMulOf, vpPen } from './traffic-shared.js';
import { TrafficLanes } from './traffic-lanes.js';
import { TrafficStep } from './traffic-step.js';
import { TrafficBoxes } from './traffic-boxes.js';
import { TrafficKnots } from './traffic-knots.js';
import { TrafficParking } from './traffic-parking.js';
import { Pedestrians } from './pedestrians.js';
export { hourDensity, bandOf, medianOf, laneOffset, junctionDist, playerPen } from './traffic-shared.js';
export { Pedestrians } from './pedestrians.js';

// ============================================================================
//  TRAFFIC — vehicles + pedestrians on the road graph.
//  Edge contract (OSM world): lanesF / lanesB / oneway / median / laneW / halfW /
//  maxspeed / type / tram / busLane / bridge / tunnel / roundabout / trafficMul.
//  Falls back gracefully to the hand-made graph (lanes, speed, no median).
// ============================================================================

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

    /** Centre station on (edge, dir), ahead of station `from`, one metre before the first one from which a body of this
     *  size is no longer wholly inside the district (the invisible boundary wall is met a little before that); Infinity
     *  when the rest of the leg is inside. Plan geometry from the source path only: the per-step guard is unchanged and
     *  still has the last word. */
    railDistrictLimit(edge, dir, length, width, route, from = 0) {
        if (!this.world.district?.inside) return Infinity;
        const cache = this._railLimits || (this._railLimits = new Map()), key = edge.id + '|' + dir + '|' + length + '|' + width + '|' + (route?.[0]?.e.id ?? '');
        let next = cache.get(key);
        if (!next) {
            // next[i]: first station index >= i (every 0.5 m) whose body pose is not wholly inside, or -1
            const n = Math.floor(edge.len / .5) + 1, probe = { edge, dir, s: 0, route: route ? route.slice() : [], hist: [] }, d = length * .36, body = { x: 0, z: 0, heading: 0, length, width };
            next = new Int32Array(n + 1).fill(-1);
            for (let i = n - 1; i >= 0; i--) {
                probe.s = Math.min(edge.len, i * .5); next[i] = next[i + 1];
                const C = sampleTramPath(probe, 0), F = sampleTramPath(probe, d), R = sampleTramPath(probe, -d);
                if (!C || !F || !R) continue; // the path ends or forks unresolved here: the leaf rule owns that stop
                const hx = F.x - R.x, hz = F.z - R.z; if (hx * hx + hz * hz < 1e-9) continue;
                body.x = C.x; body.z = C.z; body.heading = Math.atan2(-hx, -hz);
                if (!this.railBodyInside(body) || this.railBodyAtClosure(body)) next[i] = i; // the guard's own domain test; a track may run right along the edge
            }
            cache.set(key, next);
        }
        const bad = next[Math.min(next.length - 1, Math.max(0, Math.ceil(from / .5 - 1e-9)))];
        return bad < 0 ? Infinity : Math.max(from, bad * .5 - 1);
    }

    /** The body's cover touches a "road closed" barrier of the district edge: the line ends there for a tram as well. */
    railBodyAtClosure(body) {
        const B = this.world.buildings; if (!B?.query) return false;
        let hit = false;
        for (const p of initialBodyCover(body)) {
            B.query(p.x, p.z, p.radius + .3, c => {
                if (hit || c.kind !== 'closure') return;
                if (c.wall) { const dx = c.bx - c.ax, dz = c.bz - c.az, t = clamp(((p.x - c.ax) * dx + (p.z - c.az) * dz) / (dx * dx + dz * dz || 1), 0, 1); if (Math.hypot(p.x - c.ax - dx * t, p.z - c.az - dz * t) < p.radius + .3) hit = true; }
                else if (Math.hypot(p.x - c.x, p.z - c.z) < p.radius + (c.r || 0) + .3) hit = true;
            });
            if (hit) return true;
        }
        return false;
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

    /** NPC head/tail lights (night) — applied to current and future vehicles */
    setNightLights(on) {
        this.nightLights = !!on;
        for (const v of this.vehicles) v.mesh.userData.setLights?.(this.nightLights);
    }
    setPlayer(p) {
        this.player = p;

    }
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
    /** 0: a viewer (player, walker, active camera: see update) within `near` metres of the point; 1: none within `near`;
     *  2: none within `far`. */
    viewerTier(x, z, near, far) {
        const F = this._viewers; if (!F || !F.length) return 0;
        let best = Infinity; for (let i = 0; i < F.length; i += 2) { const dx = x - F[i], dz = z - F[i + 1], d = dx * dx + dz * dz; if (d < best) best = d; }
        return best < near * near ? 0 : best < far * far ? 1 : 2;
    }
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
        if (v.edge?.rail) this.poseTramSections(v);
    }
    /** an articulated tram's section meshes, each on the rail at its own heading, in the body's frame (the body's pitch
     *  carries them up a ramp); rigid layout when the path does not resolve */
    poseTramSections(v) {
        const u = v.mesh?.userData, G = u?._sectionGroups; if (!G) return;
        const P = tramSectionPoses(v, u.sections, v.width), h = v.heading, c = Math.cos(h), s = Math.sin(h);
        for (let i = 0; i < G.length; i++) {
            const g = G[i];
            if (!P) { g.position.set(0, 0, -u.sections[i].along); g.rotation.set(0, 0, 0); continue; }
            const dx = P[i].x - v.x, dz = P[i].z - v.z;
            g.position.set(dx * c - dz * s, 0, dx * s + dz * c); g.rotation.set(0, Math.atan2(Math.sin(P[i].heading - h), Math.cos(P[i].heading - h)), 0);
        }
    }
    /** move vehicle v onto a random edge whose midpoint is rMin..rMax from the player. returns success */
    relocate(v, rMin, rMax, hidden) {
        const P = this.player; if (!P || (hidden && v.mesh.visible !== false && this.inView(v))) return false;
        const cands = this.nearEdges(rMax, !!v.edge.rail);
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
        this.peds.recycle(); // (walkers stay around the player; districts keep every vehicle in play)
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
        const P = this.player, lod = false;
        // who is looking: the player, the walker on foot, and the active camera (a drone or an office window is elsewhere)
        const viewers = this._viewers || (this._viewers = []); viewers.length = 0;
        if (P) viewers.push(P.x, P.z);
        if (this.walker?.active) viewers.push(this.walker.x, this.walker.z);
        { const camera = this.observerCamera || (globalThis.game?.traffic === this ? globalThis.game.camera : null), m = camera?.matrixWorld?.elements; if (m && Number.isFinite(m[12]) && Number.isFinite(m[14])) viewers.push(m[12], m[14]); }
        const lodDistrict = (viewers.length > 0) && this.districtLod !== false;
        this.stats.lodVehicles = 0;
        if (P) P.stillT = Math.abs(P.speed) < 0.5 ? (P.stillT || 0) + dt : 0; // (mutual waits with a stopped player, stepVehicle)
        for (let i = 0; i < all.length; i++) {
            const v = all[i];
            if (v.parked) { v.honkCd -= dt; continue; }
            // LOD: far vehicles (out of the interesting area) step every other frame with 2·dt
            if (lod) {
                const dx = v.x - P.x, dz = v.z - P.z;
                if (dx * dx + dz * dz > 90000) { if (((this._frame + v.id) & 1) === 0) continue; this.stepVehicle(v, Math.min(dt * 2, 0.08)); continue; }
            }
            else if (lodDistrict) {
                // (a vehicle that has stood still for a second, wherever it is, is asked every other frame: it starts a frame later)
                const tier = this.viewerTier(v.x, v.z, DISTRICT_LOD_VEHICLE_M, DISTRICT_LOD_VEHICLE_FAR_M), n = lodStride(tier || (v.speed === 0 && v.still > 1 && !v.tram ? 1 : 0), dt);
                if (n > 1) { this.stats.lodVehicles++; if ((this._frame + v.id) % n) continue; this.stepVehicle(v, dt * n); continue; }
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
        if (this._dlT > 1) { this._dlT = 0; this.resolveDeadlocks(); this.breakLeaderRings(); }
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
            this.respawn(v, false);
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
            this.respawn(v, false);
            v.touchT = 0; n++;
        }
        this.grid.build(this.vehicles);
        return n;
    }
    /** nearest police car within r (or null) */
    policeNear(x, z, r) { let best = null, bd = r; for (const p of this.police) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; }

    dispose() { try { this.endParking('dispose'); } catch { /* ignore */ } this._situational?.dispose();this._situational=null;for(const timer of this._replyTimers||[])clearTimeout(timer);this._replyTimers?.clear();this._bub=[];this.scene.remove(this.group); this.peds.dispose(); }
}
mixin(Traffic, TrafficLanes, TrafficStep, TrafficBoxes, TrafficKnots, TrafficParking);
