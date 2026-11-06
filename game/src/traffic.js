import * as THREE from '../vendor/three.module.min.js';
import { makeVehicle, CAR_COLORS } from './vehicles.js';
import { makeRng, clamp, angleLerp } from './util.js';
import { lanesDir, canTravel, edgeSpeed, isMotorway, turnAngle, nodeList, EdgeIndex } from './nav.js';

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
export function laneOffset(edge, lane, dir = 1) { return medianOf(edge) / 2 + (edge.laneW ?? 3.3) * (lane + 0.5); }
const tramOffset = (e) => Math.max(1.45, medianOf(e) / 4); // two 2.4 m trams side by side never touch
const layerOf = (e) => (e.bridge ? 1 : 0) + (e.tunnel ? -1 : 0) + (e.layer | 0);
const isJunction = (n) => n.edges.length >= 3 || n.hasLight;
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
    const dx = P.x - x, dz = P.z - z;
    let min = Infinity;
    for (const [ux, uz] of [[fx, fz], [rx, rz], [P.fx, P.fz], [prx, prz]]) {
        const ra = Math.abs(fx * ux + fz * uz) * vl + Math.abs(rx * ux + rz * uz) * vw;
        const pen = ra + playerExtent(P, ux, uz) - Math.abs(dx * ux + dz * uz);
        if (pen < min) min = pen;
    }
    return min;
}

// ---------- fixed-size spatial hash (no per-frame allocation) ----------
class Grid {
    constructor(cell, bits = 12) { this.cell = cell; this.mask = (1 << bits) - 1; this.head = new Int32Array(1 << bits); this.next = new Int32Array(64); this.items = null; }
    hash(ix, iz) { return ((ix * 92837111) ^ (iz * 689287499)) & this.mask; }
    build(items) {
        this.items = items; this.head.fill(-1);
        if (this.next.length < items.length) this.next = new Int32Array(items.length * 2);
        const c = this.cell;
        for (let i = 0; i < items.length; i++) { const h = this.hash(Math.floor(items[i].x / c), Math.floor(items[i].z / c)); this.next[i] = this.head[h]; this.head[h] = i; }
    }
    /** calls fn(item) for items in cells overlapping the square (x±r, z±r); may include a few extras (hash collisions) */
    query(x, z, r, fn) {
        const c = this.cell, x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c), z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
        const it = this.items;
        if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) { for (const o of it) fn(o); return; }
        for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
            for (let i = this.head[this.hash(ix, iz)]; i !== -1; i = this.next[i]) {
                const o = it[i]; const ox = Math.floor(o.x / c), oz = Math.floor(o.z / c);
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
        this.onHonk = opts.onHonk || (() => { });
        this.player = null;
        this.maxVehicles = opts.maxVehicles || (this.buc ? 210 : 70);
        this.group = new THREE.Group();
        scene.add(this.group);
        this.index = opts.index || new EdgeIndex(world.graph.edges);
        this.grid = new Grid(16);
        this.police = [];
        this._lightPhase = new Map();
        this.claims = new Map(); // junction exit-lane claims (key → {v, t})
        this.stats = { updateMs: 0 };
        this._idSeq = 0;
        this.buildBusStops();
        this.spawnAll();
        this.base = { moving: this.vehicles.filter(v => this.cls(v) === 'moving').length, parked: this.vehicles.filter(v => v.parked).length };
        this.peds = new Pedestrians(this, opts.maxPeds ?? (this.buc ? 250 : 60));
        if (opts.hour != null) this.setHour(opts.hour, true);
    }

    // ------------------------------------------------------------------ traffic by hour
    cls(v) { return v.parked ? 'parked' : (v.tram || v.isPolice) ? 'fixed' : 'moving'; }
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
        this.target = {
            moving: Math.round(this.base.moving * clamp(pr.density / peak, 0.08, 1)),
            parked: Math.round(this.base.parked * clamp(pr.parked, 0, 1)),
        };
        this.chaos = clamp(this.baseChaos * pr.aggression, 0, 1);
        if (instant) this.rebalance(1e9);
        if (prev.band !== pr.band) this.onBand(pr.band, prev.hour == null ? null : prev.band, pr);
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
                if (this.large) ok = this.relocate(v, 300, this.bubble, true);
                else { this.respawn(v); ok = true; }
                if (!ok) { v.inactive = true; continue; }
                this.pool.splice(i, 1); v.mesh.visible = true; this.vehicles.push(v);
                v.mesh.userData.setLights?.(this.nightLights);
                diff++; budget--; changed = true;
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
        if (!node.hasLight) return 'green';
        if (this.world.lightState) return this.world.lightState(node.id, edge, this.time, this.cycle);
        // fallback: two phases by approach orientation
        let ph = this._lightPhase.get(node);
        if (!ph) {
            ph = new Map(); const ref = node.edges[0]; const ra = Math.atan2(ref.dirz, ref.dirx);
            for (const e of node.edges) { let d = Math.abs(((Math.atan2(e.dirz, e.dirx) - ra) % Math.PI + Math.PI) % Math.PI); if (d > Math.PI / 2) d = Math.PI - d; ph.set(e, d < Math.PI / 4 ? 0 : 1); }
            ph.offset = (node.x * 7.31 + node.z * 3.17) % 20; this._lightPhase.set(node, ph);
        }
        const phase = ph.get(edge); if (phase === undefined) return 'green';
        const t = ((this.time + ph.offset) % (this.cycle * 2) + this.cycle * 2) % (this.cycle * 2);
        const inPhase = phase === 0 ? t < this.cycle : t >= this.cycle;
        if (!inPhase) return 'red';
        const local = phase === 0 ? t : t - this.cycle;
        return local > this.cycle - 2.2 ? 'yellow' : 'green';
    }

    // ------------------------------------------------------------------ bus stops
    buildBusStops() {
        this.busStops = new Map(); // edge -> [{s (a→b), side}]
        const add = (e, s, side) => { let a = this.busStops.get(e); if (!a) this.busStops.set(e, a = []); a.push({ s, side, id: this.busStops.size + ':' + a.length }); };
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
        const kindsB = [['hatch', 0.38], ['sedan', 0.2], ['suv', 0.1], ['taxi', 0.11], ['van', 0.1], ['bus', 0.05], ['truck', 0.03], ['pickup', 0.03]];
        const kindsS = [['suv', 0.34], ['pickup', 0.18], ['sedan', 0.25], ['hatch', 0.06], ['van', 0.07], ['truck', 0.05], ['bus', 0.03], ['taxi', 0.02]];
        const kinds = this.buc ? kindsB : kindsS;
        const pickKind = (e) => {
            let r = this.rng(); let k = 'sedan';
            for (const [kk, p] of kinds) { r -= p; if (r <= 0) { k = kk; break; } }
            if (k === 'bus' && isMotorway(e)) k = 'sedan';
            return k;
        };
        const plan = [];
        for (const e of edges) {
            if (e.len < 4) continue;
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
            const k = e.id + ':' + dir + ':' + lane; const arr = occupied.get(k) || [];
            for (const o of arr) if (Math.abs(o - s) < len + 3) return false;
            arr.push(s); occupied.set(k, arr); return true;
        };
        const nPolice = this.buc ? 2 : 2;
        for (const { e, dir } of plan) {
            if (this.vehicles.length >= this.maxVehicles - nPolice) break;
            const kind = pickKind(e);
            const lanes = lanesDir(e, dir);
            const lane = kind === 'bus' ? lanes - 1 : this.rng.int(0, lanes - 1);
            const s = e.len < 10 ? e.len / 2 : this.rng.range(4, e.len - 4);
            if (!free(e, dir, lane, s, kind === 'bus' ? 12 : 5)) continue;
            this.spawn({ edge: e, dir, lane, s, kind });
        }
        // police cruisers on bigger roads
        const big = edges.filter(e => !e.tram && e.len > 30 && trafficMulOf(e) >= 0.9);
        for (let i = 0; i < nPolice && big.length; i++) {
            const e = this.rng.pick(big); const dir = canTravel(e, 1) ? 1 : -1;
            const v = this.spawn({ edge: e, dir, lane: 0, s: this.rng.range(2, e.len - 2), kind: 'police' });
            this.police.push(v);
        }
        // double-parked cars (Bucharest special)
        const pc = this.city.traffic?.parkedChance ?? 0;
        const maxParked = Math.round(this.maxVehicles * 0.2), maxTrams = this.large ? 26 : 200;
        let nParked = 0, nTrams = 0;
        const shuffled = edges.slice(); for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
        if (pc > 0) {
            for (const e of shuffled) {
                if (nParked >= maxParked) break;
                if (isMotorway(e) || e.type === 'dn' || e.roundabout || e.len < 40) continue;
                const exp = e.len / 90 * pc; let n = Math.floor(exp); if (this.rng() < exp - n) n++;
                for (let i = 0; i < n; i++) {
                    const dir = this.rng.pick([1, -1]); const lanes = lanesDir(e, dir); if (!this.parkOk(e, dir)) continue;
                    const s = this.rng.range(15, e.len - 15);
                    if (junctionDist(e, s) < 30 || !free(e, dir, lanes - 1, s, 6)) continue;
                    const v = this.spawn({ edge: e, dir, lane: lanes - 1, s, kind: this.rng.pick(['hatch', 'sedan', 'van', 'hatch']) });
                    v.parked = true; v.speed = 0; v.lateralExtra = (e.laneW ?? 3.3) * 0.55; v.hazard = true; nParked++;
                    this.placeOnLane(v, true, 0);
                }
            }
        }
        // trams
        if (this.city.traffic?.trams) {
            for (const e of shuffled) {
                if (!e.tram || e.len < 25 || nTrams >= maxTrams) continue;
                const exp = e.len / 600; let n = Math.floor(exp); if (this.rng() < exp - n || e.len > 300) n = Math.max(n, 1);
                for (let i = 0; i < n; i++) for (const dir of [1, -1]) {
                    const s = this.rng.range(5, e.len - 5);
                    if (!free(e, dir, 'tram', s, 16)) continue;
                    const v = this.spawn({ edge: e, dir, lane: 0, s, kind: 'tram' });
                    v.tram = true; v.nextStopOdo = this.rng.range(80, 400); nTrams++;
                }
            }
        }
    }

    spawn({ edge, dir, lane, s, kind }) {
        const isTaxi = kind === 'taxi';
        let color;
        if (isTaxi) color = '#ffd400';
        else if (kind === 'bus') color = this.buc ? '#f2c230' : '#2e7d32';
        else if (kind === 'tram') color = this.rng.chance(0.5) ? '#d9262c' : '#f2c230';
        else if (kind === 'police') color = this.buc ? '#f1f5f9' : '#111827';
        else color = this.rng.pick(CAR_COLORS);
        const mesh = makeVehicle(kind, color);
        if (isTaxi && !mesh.userData.length) mesh.userData.length = 4.4, mesh.userData.width = 1.8;
        this.group.add(mesh);
        const lo = this.buc ? 0.95 : 1.0, hi = this.buc ? 1.25 : 1.12;
        const v = {
            id: this._idSeq++, edge, dir, lane, s, kind, mesh,
            length: mesh.userData.length || 4.4, width: mesh.userData.width || 1.8,
            speed: 0, desiredMul: kind === 'bus' || kind === 'truck' ? this.rng.range(0.85, 0.95) : this.rng.range(lo, hi),
            stuck: 0, honkAt: this.rng.range(2.5, 7) / (0.3 + this.chaos), honkCd: 0,
            laneCur: lane, lateralExtra: 0, latExtraCur: 0, parked: false, tram: kind === 'tram', bus: kind === 'bus', isPolice: kind === 'police',
            bubbleCd: 0, annoyed: 0, route: [], ghost: 0, odo: 0, stopDone: null, stopTimer: 0, bypass: null, bypassT: 0, dwell: 0, served: null,
            x: 0, z: 0, y: 0.24, heading: 0, fx: 0, fz: 1, rx: 1, rz: 0, layer: layerOf(edge),
            laneChangeCd: this.rng.range(1, 6), leader: null, gap: Infinity,
            still: 0, touchT: 0, waitRed: false, blockT: 0,
        };
        if (v.isPolice) this.addLightbar(v);
        if (this.nightLights) mesh.userData.setLights?.(true);
        this.placeOnLane(v, true, 0);
        this.vehicles.push(v);
        return v;
    }

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
        const P = this.player;
        if (P) {
            const dx = v.x - P.x, dz = v.z - P.z, d = Math.hypot(dx, dz);
            if (d < 18) return false;
            if (d < 40 && dx * P.fx + dz * P.fz > -4) return false; // in front of the player
        }
        let ok = true;
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
    noteRelocated(v) { if (this._bulk) { this._bulk.push(v); return; } const r = this._recent || (this._recent = []); r.push(v); if (r.length > 32) r.shift(); }

    /** world position for a vehicle's lane state */
    laneTarget(v, out) {
        const e = v.edge;
        const fx = e.dirx * v.dir, fz = e.dirz * v.dir;
        const rx = e.nx * v.dir, rz = e.nz * v.dir;
        const start = v.dir > 0 ? e.a : e.b;
        const lat = v.tram ? tramOffset(e) : laneOffset(e, v.laneCur) + v.latExtraCur;
        out.x = start.x + fx * v.s + rx * lat; out.z = start.z + fz * v.s + rz * lat;
        out.fx = fx; out.fz = fz; out.rx = rx; out.rz = rz;
        return out;
    }

    placeOnLane(v, snap, dt) {
        const t = this.laneTarget(v, this._t || (this._t = {}));
        v.fx = t.fx; v.fz = t.fz; v.rx = t.rx; v.rz = t.rz;
        if (snap) { v.x = t.x; v.z = t.z; v.heading = Math.atan2(-t.fx, -t.fz); }
        else {
            // move fully along the lane direction, damp the lateral component -> smooth curves through bends
            const dx = t.x - v.x, dz = t.z - v.z;
            const along = dx * t.fx + dz * t.fz, lat = dx * t.rx + dz * t.rz;
            const k = 1 - Math.exp(-(v.transition > 0 ? 5 : 9) * dt);
            const ox = v.x, oz = v.z;
            if (Math.abs(lat) > 12 || Math.abs(along) > 25) { v.x = t.x; v.z = t.z; }
            else { v.x += t.fx * along + t.rx * lat * k; v.z += t.fz * along + t.rz * lat * k; }
            const mx = v.x - ox, mz = v.z - oz;
            if (mx * mx + mz * mz > 1e-5) v.heading = angleLerp(v.heading, Math.atan2(-mx, -mz), 1 - Math.exp(-14 * dt));
        }
        const e = v.edge;
        if (e.a.y !== undefined && e.b.y !== undefined) { const tt = clamp(v.dir > 0 ? v.s / e.len : 1 - v.s / e.len, 0, 1); v.y = e.a.y + (e.b.y - e.a.y) * tt + 0.24; }
        v.mesh.position.set(v.x, v.y, v.z);
        // pitch with the ramp (bridges / tunnels)
        const slope = e.a.y !== undefined && e.b.y !== undefined ? (e.b.y - e.a.y) / Math.max(1, e.len) * v.dir : 0;
        v.mesh.rotation.set(Math.atan(slope), v.heading, 0, 'YXZ');
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
            this.peds.relocateAll();
            this.grid.build(this.vehicles);
        }
    }
    get bubble() { return 650; }
    /** edges around the player, cached (refreshed when the player moved 80 m or every 2 s) */
    nearEdges(r) {
        const P = this.player; const c = this._ne || (this._ne = {});
        const k = 'r' + r; let e = c[k];
        if (!e || Math.hypot(e.x - P.x, e.z - P.z) > 80 || this.time - e.t > 2) {
            e = c[k] = { x: P.x, z: P.z, t: this.time, list: this.index.near(P.x, P.z, r, []).filter(ed => ed.len >= 8) };
        }
        return e.list;
    }
    /** move vehicle v onto a random edge whose midpoint is rMin..rMax from the player. returns success */
    relocate(v, rMin, rMax, hidden) {
        const P = this.player; if (!P) return false;
        const cands = this.nearEdges(rMax <= this.bubble ? this.bubble : rMax);
        if (!cands.length) return false;
        const save = { edge: v.edge, dir: v.dir, s: v.s, lane: v.lane, laneCur: v.laneCur, le: v.lateralExtra, lc: v.latExtraCur, layer: v.layer, speed: v.speed };
        for (let tries = 0; tries < 60; tries++) {
            const e = cands[Math.floor(this.rng() * cands.length)];
            if (e.len < 8 || (e.main === false && !v.tram)) continue;
            if (v.tram !== !!e.tram && v.tram) continue;
            if (v.parked && !(this.parkOk(e, 1) || this.parkOk(e, -1))) continue;
            if (v.bus && isMotorway(e)) continue;
            const mul = trafficMulOf(e);
            if (this.rng() > Math.min(1, mul * 0.6 + 0.08)) continue;
            const mx = (e.a.x + e.b.x) / 2 - P.x, mz = (e.a.z + e.b.z) / 2 - P.z; const d = Math.hypot(mx, mz);
            if (d < rMin || d > rMax) continue;
            if (hidden && d < 600 && (mx * P.fx + mz * P.fz) > 0) continue; // ahead & near: would pop in view
            let dir = this.rng() < 0.5 ? 1 : -1; if (!canTravel(e, dir)) dir = -dir; if (!canTravel(e, dir)) continue;
            if (v.parked && !this.parkOk(e, dir)) { dir = -dir; if (!this.parkOk(e, dir)) continue; }
            const lanes = lanesDir(e, dir);
            const s = v.parked ? this.rng.range(15, e.len - 15) : this.rng.range(Math.min(4, e.len / 2), Math.max(e.len / 2, e.len - 4));
            if (v.parked && junctionDist(e, dir > 0 ? s : e.len - s) < 30) continue;
            v.edge = e; v.dir = dir; v.s = s; v.route.length = 0; v.layer = layerOf(e);
            v.lane = v.laneCur = v.parked || v.bus ? lanes - 1 : this.rng.int(0, lanes - 1);
            v.speed = v.parked ? 0 : Math.min(edgeSpeed(e) * 0.7, 8); v.stuck = 0; v.still = 0; v.touchT = 0; v.blockT = 0; v.ghost = 0; v.bypass = null; v.served = null; v.dwell = 0;
            if (!v.parked) v.latExtraCur = v.lateralExtra = 0; else v.latExtraCur = v.lateralExtra = (e.laneW ?? 3.3) * 0.55;
            this.placeOnLane(v, true, 0);
            if (!this.spawnClear(v)) continue; // never on top of / just ahead of the player, never overlapping
            this.noteRelocated(v);
            return true;
        }
        // no free spot: put it back where it was (a failed try must not leave it overlapping someone)
        v.edge = save.edge; v.dir = save.dir; v.s = save.s; v.lane = save.lane; v.laneCur = save.laneCur; v.lateralExtra = save.le; v.latExtraCur = save.lc; v.layer = save.layer; v.speed = save.speed; v.route.length = 0;
        this.placeOnLane(v, true, 0);
        return false;
    }
    recycle() {
        const P = this.player; if (!P || !this.large) return;
        const all = this.vehicles; const n = Math.min(all.length, 25);
        const R = this.bubble + 100;
        for (let k = 0; k < n; k++) {
            this._rr = ((this._rr || 0) + 1) % all.length;
            const v = all[this._rr];
            const d = Math.hypot(v.x - P.x, v.z - P.z);
            if (d > R) this.relocate(v, 350, this.bubble, true);
        }
        this.peds.recycle();
    }

    // ------------------------------------------------------------------ routing
    chooseNext(e, dir, v) {
        const node = dir > 0 ? e.b : e.a;
        const fx = e.dirx * dir, fz = e.dirz * dir;
        let best = null, total = 0;
        const cands = this._cands || (this._cands = []); cands.length = 0;
        for (const n of node.edges) {
            if (n === e) continue;
            const nd = n.a === node ? 1 : -1;
            if (!canTravel(n, nd)) continue;
            if (v.tram && !n.tram) continue;
            if (!v.tram && n.tram && n.tramOnly) continue;
            if (n.type === 'service' && !v.isPolice && this.rng() < 0.8) continue;
            if (n.main === false && e.main !== false && !v.tram) continue; // never drive into a one-way trap
            const dot = n.dirx * nd * fx + n.dirz * nd * fz;
            let w = (1 + Math.max(0, dot) * 2.5) * (0.4 + trafficMulOf(n));
            if (dot < -0.6) w *= 0.05; // avoid hairpins
            if (e.name && n.name === e.name) w *= 5;
            if (e.roundabout && n.roundabout) w *= 1.5;
            cands.push({ n, nd, w }); total += w;
        }
        if (!cands.length) {
            if (canTravel(e, -dir) && !e.roundabout) return { e, dir: -dir, uturn: true };
            return null;
        }
        let r = this.rng() * total;
        for (const c of cands) { r -= c.w; if (r <= 0) { best = c; break; } }
        best = best || cands[cands.length - 1];
        return { e: best.n, dir: best.nd };
    }
    ensureRoute(v) {
        const R = v.route;
        let dist = v.edge.len - v.s;
        for (const r of R) dist += r.e.len;
        let last = R.length ? R[R.length - 1] : { e: v.edge, dir: v.dir };
        while ((dist < 140 || R.length < 2) && R.length < 24) {
            const nx = this.chooseNext(last.e, last.dir, v);
            if (!nx) break;
            R.push(nx); dist += nx.e.len; last = nx;
            if (nx.uturn) break;
        }
    }
    advance(v) {
        const e = v.edge;
        const nx = v.route.shift();
        if (!nx) { this.respawn(v); return; }
        v.s -= e.len;
        if (v.s < 0) v.s = 0;
        v.edge = nx.e; v.dir = nx.dir; v.layer = layerOf(nx.e);
        const lanes = lanesDir(nx.e, nx.dir) || 1;
        if (v.bus) v.lane = lanes - 1;
        else if (lanes > lanesDir(e, v.dir) && this.buc && this.rng() < 0.12) { const l = this.rng.int(0, lanes - 1); if (Math.abs(l - v.lane) <= 1 && l < lanes && this.laneFree(v, l)) v.lane = l; }
        v.lane = clamp(v.lane, 0, lanes - 1);
        v.laneCur = clamp(v.laneCur, 0, lanes - 1);
        if (nx.uturn) { v.laneCur = v.lane; v.transition = 1.2; }
        else v.transition = 0.6;
    }
    /** move a vehicle somewhere else in the city, out of sight of the player */
    respawn(v) {
        if (this.large && this.relocate(v, 300, this.bubble, true)) return;
        const edges = this.world.graph.edges; const P = this.player;
        const save = { edge: v.edge, dir: v.dir, s: v.s, lane: v.lane, laneCur: v.laneCur, layer: v.layer };
        for (let tries = 0; tries < 30; tries++) {
            const e = edges[Math.floor(this.rng() * edges.length)];
            if (v.tram && !e.tram) continue;
            const dir = canTravel(e, 1) ? (canTravel(e, -1) && this.rng() < 0.5 ? -1 : 1) : (canTravel(e, -1) ? -1 : 0);
            if (!dir || e.len < 8) continue;
            const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
            if (P && Math.hypot(mx - P.x, mz - P.z) < 180) continue;
            v.edge = e; v.dir = dir; v.s = this.rng.range(2, e.len - 2); v.route.length = 0; v.speed = 0; v.stuck = 0; v.still = 0; v.touchT = 0; v.layer = layerOf(e);
            v.lane = v.laneCur = clamp(v.lane, 0, lanesDir(e, dir) - 1); v.bypass = null; v.latExtraCur = v.lateralExtra = 0;
            this.placeOnLane(v, true, 0);
            if (!this.spawnClear(v)) continue;
            this.noteRelocated(v);
            return;
        }
        // nowhere better: back where it was, then turn around only where that is legal
        v.edge = save.edge; v.dir = save.dir; v.s = save.s; v.lane = save.lane; v.laneCur = save.laneCur; v.layer = save.layer;
        if (canTravel(v.edge, -v.dir)) { v.dir = -v.dir; v.s = Math.max(0, v.edge.len - v.s); } else if (v.s >= v.edge.len - 0.5) v.s = 0;
        this.placeOnLane(v, true, 0);
        v.route.length = 0;
    }

    // ------------------------------------------------------------------ main update
    update(dt) {
        const t0 = performance.now();
        this.time += dt;
        dt = Math.min(dt, 0.05);
        if (dt <= 0) return;
        this._dt = dt;
        const all = this.vehicles;
        this.grid.build(all);
        this.peds.buildGrid();
        this._frame = (this._frame || 0) + 1;
        const P = this.player, lod = this.large && P;
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
        // vehicles touching the player for > 3 s get nudged away (incl. parked ones)
        if (P) {
            for (const v of this.near(P.x, P.z, 12)) {
                if (Math.abs((P.y ?? 0.24) - v.y) > 2.5) { v.touchT = 0; continue; }
                if (playerPen(v, P) > -0.15) { v.touchT += dt; if (v.touchT > 3) this.nudge(v); }
                else v.touchT = Math.max(0, v.touchT - dt);
            }
        }
        this._dlT = (this._dlT || 0) + dt;
        if (this._dlT > 1) { this._dlT = 0; this.resolveDeadlocks(); }
        if ((this._frame & 63) === 0) for (const [k, c] of this.claims) if (this.time - c.t > 4) this.claims.delete(k);
        this._rbT = (this._rbT || 0) + dt;
        if (this._rbT > 0.25) { this._rbT = 0; this.rebalance(2); }
        this.peds.update(dt);
        this.recycle();
        if (this._recent) this._recent.length = 0;
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
        this.ensureRoute(v);
        const e = v.edge, L = e.len, half = v.length / 2;
        const lim = v.tram ? 11 : edgeSpeed(e);
        let desired = lim * (v.tram ? 1 : v.desiredMul) * (this.weatherMul ?? 1); // rain / snow: everyone drives slower
        const P = this.player;
        // ---------------- obstacles (cone scan via grid) ----------------
        let gap = Infinity, leader = null, leaderSpeed = 0, leaderCross = false;
        const look = clamp(10 + v.speed * 2.4, 14, 55);
        const fx = v.fx, fz = v.fz, rx = v.rx, rz = v.rz;
        const endNode = v.dir > 0 ? e.b : e.a, startNode = v.dir > 0 ? e.a : e.b;
        const endRad = endNode.radius ?? 6;
        const toEntry = L - v.s - half - endRad; // front bumper → edge of the junction box ahead
        const nearEnd = toEntry < 12;
        // already committed to (inside) a junction box: clear it instead of stopping in it
        const inJunction = (isJunction(endNode) && toEntry < -0.5) || (isJunction(startNode) && v.s - half < (startNode.radius ?? 6) - 0.5);
        if (v.ghost > 0) v.ghost -= dt;
        else {
            this.grid.query(v.x + fx * look * 0.5, v.z + fz * look * 0.5, look * 0.5 + 8, (o) => {
                if (o === v || o === v.bypass) return;
                const dx = o.x - v.x, dz = o.z - v.z;
                const f = dx * fx + dz * fz; if (f <= 0 || f > look + o.length * 0.5) return;
                if (o.layer !== v.layer) return;
                const l = dx * rx + dz * rz;
                const ol = Math.abs(o.fx * rx + o.fz * rz) * o.length * 0.5 + Math.abs(o.rx * rx + o.rz * rz) * o.width * 0.5;
                if (Math.abs(l) > v.width * 0.5 + ol + 0.3) return;
                const hd = o.fx * fx + o.fz * fz;
                if (hd < -0.3) return; // oncoming
                const of = Math.abs(o.fx * fx + o.fz * fz) * o.length * 0.5 + Math.abs(o.rx * fx + o.rz * fz) * o.width * 0.5;
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
                if (f > 0 && f < look + 8 && Math.abs(l) < v.width * 0.5 + playerExtent(P, rx, rz) + 0.35) {
                    const g = f - half - playerExtent(P, fx, fz);
                    if (g < gap) { gap = g; leader = P; leaderSpeed = Math.max(0, P.speed * (P.fx * fx + P.fz * fz)); leaderCross = false; }
                }
            }
        }
        const pg = this.peds.obstacleGap(v, look);
        if (pg < gap) { gap = pg; leader = 'ped'; leaderSpeed = 0; leaderCross = false; }
        if (leader === P && P && Math.abs(P.speed) < 1.2 && gap < 14) v.blockT += dt; else v.blockT = Math.max(0, v.blockT - dt * 2);

        // ---------------- path constraints: lights, stops, zebras, turns ----------------
        let stopD = Infinity, vCap = Infinity, waitingRed = false;
        let curE = e, curDir = v.dir, D = L - v.s - half;
        const maxLook = Math.max(70, v.speed * v.speed / 4 + 30);
        for (let k = -1; k < v.route.length && D < maxLook; k++) {
            const node = curDir > 0 ? curE.b : curE.a;
            const nxt = v.route[k + 1];
            const rad = node.radius ?? 6;
            if (node.hasLight && !v.isPolice) {
                const st = this.lightState(node, curE);
                const d = D - rad - 1.6;
                if (d > -0.5 && (st === 'red' || (st === 'yellow' && d > v.speed * 1.1))) { stopD = Math.min(stopD, d); if (d < 10) waitingRed = true; break; }
            }
            if (node.stop && v.stopDone !== node) {
                const d = D - rad - 1;
                if (d < 1.5 && v.speed < 0.6) { v.stopTimer += dt; if (v.stopTimer > 1.0) { v.stopDone = node; v.stopTimer = 0; } }
                if (v.stopDone !== node) { stopD = Math.min(stopD, d); break; }
            }
            if ((node.crossing || node.hasLight) && this.peds.crossingAt(node)) {
                const d = D - rad - 3.5; if (d > -1) { stopD = Math.min(stopD, d); break; }
            }
            if (nxt && nxt.e.roundabout && !curE.roundabout && this.roundaboutBusy(node, v)) { stopD = Math.min(stopD, D - rad - 1); break; }
            // don't block the box: if the queue beyond the junction leaves no room for us, wait at the line
            if (k === -1 && isJunction(node) && D - rad > 0.5 && leader && leader !== 'ped' && !leaderCross && leaderSpeed < 2) {
                const entry = D - rad;
                if (gap > entry - 0.5 && gap < entry + 2 * rad + v.length + 1.5) stopD = Math.min(stopD, entry - 0.5);
            }
            if (v.bus) { const bs = this.busStopAhead(v, curE, curDir, D, k === -1); if (bs < stopD) { stopD = bs; } }
            // exit-lane claims: two cars from different approaches must not merge into the same lane of the exit edge
            // at the same time (the first one at the line claims it; the others wait until it is clear of the box)
            if (k === -1 && nxt && !v.tram && isJunction(node) && D - rad < 9 && !inJunction) {
                const nl = Math.max(1, lanesDir(nxt.e, nxt.dir)), key = nxt.e.id * 64 + (nxt.dir > 0 ? 0 : 32) + Math.min(v.lane, nl - 1);
                const c = this.claims.get(key);
                const held = c && c.v !== v && !c.v.inactive && this.time - c.t < 3 && c.v.edge !== curE &&
                    (c.v.edge !== nxt.e || c.v.s < c.v.length + 2.5);
                if (held) stopD = Math.min(stopD, D - rad - 0.8);
                else if (D - rad < 4 && (!c || c.v !== v || v.speed > 0.5)) this.claims.set(key, { v, t: this.time });
            }
            // lane drop ahead (next edge has fewer lanes): merge before the end of this edge, or wait at the end
            // instead of being squeezed sideways onto a car in the remaining lane
            if (k === -1 && nxt && !v.tram && !nxt.uturn) {
                const nl = Math.max(1, lanesDir(nxt.e, nxt.dir));
                if (v.lane > nl - 1 && D < 60) {
                    if (this.laneFree(v, v.lane - 1)) { v.lane--; v.laneChangeCd = 2; }
                    else stopD = Math.min(stopD, D - rad - 1.5);
                } else if (v.lane > nl - 1) { /* far: handled when closer */ }
                else if (v.laneCur > nl - 1 + 0.25 && D - rad < 6) stopD = Math.min(stopD, D - rad - 1.5); // still sliding over
            }
            if (!nxt) break;
            const ang = Math.abs(nxt.uturn ? Math.PI : turnAngle(curE.dirx * curDir, curE.dirz * curDir, nxt.e.dirx * nxt.dir, nxt.e.dirz * nxt.dir));
            if (ang > 0.22) {
                const vTurn = ang > 2.6 ? 2.5 : Math.max(4.5, desired - (desired - 5) * clamp((ang - 0.22) / 1.35, 0, 1));
                vCap = Math.min(vCap, Math.sqrt(vTurn * vTurn + 2 * 2.6 * Math.max(0, D)));
            }
            const ns = (v.tram ? 11 : edgeSpeed(nxt.e) * v.desiredMul);
            if (ns < desired) vCap = Math.min(vCap, Math.sqrt(ns * ns + 2 * 2 * Math.max(0, D)));
            D += nxt.e.len; curE = nxt.e; curDir = nxt.dir;
        }
        // trams: stops every few hundred metres
        if (v.tram) {
            const d = v.nextStopOdo - v.odo;
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
        const accel = v.tram ? 1.2 : v.bus || v.kind === 'truck' ? 1.6 : (this.buc ? 3.0 : 2.4);
        if (target > v.speed) v.speed = Math.min(target, v.speed + accel * dt);
        else v.speed = Math.max(target, v.speed - (leader === P && gap < 3 ? 14 : 8.5) * dt);
        if (v.speed < 0.05) v.speed = 0;
        v.gap = gap; v.leader = leader; v.leaderCross = leaderCross;

        // ---------------- stuck / honking ----------------
        // waiting in a red-light queue is not "stuck"
        const redQ = waitingRed || (leader && typeof leader === 'object' && leader !== P && (leader.waitRed || leader.redQ) && gap < 12);
        v.waitRed = waitingRed; v.redQ = !!redQ;
        if (v.speed < 0.3 && desired > 1 && v.dwell === 0) {
            v.stuck += dt;
            if (!redQ) v.still += dt; else v.still = 0;
            v.honkCd -= dt;
            if (v.stuck > v.honkAt && v.honkCd <= 0 && !waitingRed) {
                v.honkCd = this.rng.range(4, 14) / (0.2 + this.chaos);
                if (this.rng.chance(0.15 + this.chaos * 0.7)) this.honk(v, 'stuck');
            }
            if (!waitingRed && leader !== P && leader !== 'ped') {
                const dP = P ? Math.hypot(P.x - v.x, P.z - v.z) : 1e9;
                if (v.stuck > 12 && dP > 150) { this.respawn(v); return; }
                if (v.stuck > 14 && leader && leaderCross) { v.ghost = 2.5; v.stuck = 8; }
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
        v.latExtraCur += (v.lateralExtra - v.latExtraCur) * (1 - Math.exp(-2 * dt * clamp(0.35 + v.speed / 4, 0.35, 1)));

        // ---------------- lane changes (rare, only when useful) ----------------
        v.laneChangeCd -= dt;
        if (!v.tram && lanes > 1 && v.laneChangeCd <= 0 && !v.bypass && !inJunction) {
            const blocked = leader && leader !== 'ped' && gap < 25 && leaderSpeed < desired * 0.6;
            const wander = this.buc && v.speed > 6 && this.rng.chance(0.0006 * this.chaos);
            let want = blocked || (v.stuck > 2 && gap < 8) || wander;
            if (v.bus && v.lane !== lanes - 1) want = true;
            if (want) {
                let options = v.bus ? [lanes - 1 > v.lane ? v.lane + 1 : v.lane - 1] : [v.lane - 1, v.lane + 1];
                options = options.filter(l => l >= 0 && l < lanes && l !== v.lane);
                if (this.rng() < 0.5) options.reverse();
                let done = false;
                for (const l of options) {
                    if (this.laneFree(v, l)) { v.lane = l; v.laneChangeCd = this.rng.range(this.buc ? 4 : 6, this.buc ? 9 : 14); done = true; if (this.chaos > 0.5 && this.rng.chance(0.2)) this.honk(v, 'lanechange'); break; }
                }
                if (!done) v.laneChangeCd = this.buc ? 0.8 : 1.5;
            }
        }
        // snapshot for the "never push into the player" guard
        let snap = null;
        if (P && Math.abs(P.x - v.x) < 14 && Math.abs(P.z - v.z) < 14 && Math.abs((P.y ?? 0.24) - v.y) < 2.5) {
            snap = this._snap || (this._snap = {});
            snap.pen = playerPen(v, P); snap.s = v.s; snap.odo = v.odo; snap.x = v.x; snap.z = v.z; snap.h = v.heading; snap.edge = v.edge;
            snap.lc = v.laneCur; snap.le = v.latExtraCur; snap.fx = v.fx; snap.fz = v.fz; snap.rx = v.rx; snap.rz = v.rz; snap.tr = v.transition;
        }
        v.laneCur += (v.lane - v.laneCur) * (1 - Math.exp(-2.2 * dt));

        // ---------------- move ----------------
        v.s += v.speed * dt; v.odo += v.speed * dt;
        if (v.transition > 0) v.transition -= dt;
        let guard = 0;
        while (v.s >= v.edge.len && guard++ < 8) { this.advance(v); this.ensureRoute(v); }
        v.annoyed = Math.max(0, v.annoyed - dt);
        v.bubbleCd -= dt;
        this.placeOnLane(v, false, dt);
        if (snap) {
            const pen = playerPen(v, P);
            if (pen > -0.05 && pen > snap.pen + 0.002) {
                // this step would push into the player: undo it (when still on the same edge) and wait
                if (v.edge === snap.edge) {
                    v.s = snap.s; v.odo = snap.odo; v.x = snap.x; v.z = snap.z; v.heading = snap.h; v.laneCur = snap.lc; v.latExtraCur = snap.le;
                    v.fx = snap.fx; v.fz = snap.fz; v.rx = snap.rx; v.rz = snap.rz; v.transition = snap.tr;
                    v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.y = v.heading;
                }
                v.speed = 0;
            }
        }
    }

    /**
     * Vehicles never drive into each other: a vehicle whose step this frame made it overlap another one more than
     * before takes the step back (same edge) and stops; the normal car-following then resolves the queue.
     */
    overlapGuard() {
        const f = this._frame;
        const pen = (ax, az, ah, al, aw, bx, bz, bh, bl, bw) => {
            const afx = -Math.sin(ah), afz = -Math.cos(ah), bfx = -Math.sin(bh), bfz = -Math.cos(bh);
            let m = Infinity;
            for (const [ux, uz] of [[afx, afz], [-afz, afx], [bfx, bfz], [-bfz, bfx]]) {
                const ra = Math.abs(afx * ux + afz * uz) * al + Math.abs(-afz * ux + afx * uz) * aw;
                const rb = Math.abs(bfx * ux + bfz * uz) * bl + Math.abs(-bfz * ux + bfx * uz) * bw;
                const p = ra + rb - Math.abs((bx - ax) * ux + (bz - az) * uz); if (p < m) m = p; if (m <= 0) return m;
            }
            return m;
        };
        for (const v of this.vehicles) {
            if (v._f !== f || v.ghost > 0 || v.parked || (v.x === v._x0 && v.z === v._z0)) continue;
            let worse = false;
            const vl = v.length / 2, vw = v.width / 2;
            this.grid.query(v.x, v.z, vl + 9, (o) => {
                if (worse || o === v || o.inactive || o.ghost > 0 || Math.abs(o.y - v.y) > 2) return;
                const ol = o.length / 2, ow = o.width / 2;
                const pNew = pen(v.x, v.z, v.heading, vl, vw, o.x, o.z, o.heading, ol, ow); if (pNew <= 0.05) return;
                const pOld = pen(v._x0, v._z0, v._h0, vl, vw, o.x, o.z, o.heading, ol, ow);
                if (pNew > pOld + 0.002) worse = true;
            });
            if (!worse) continue;
            this.stats.guard = (this.stats.guard || 0) + 1;
            if (v.edge === v._e0) {
                v.s = v._s0; v.odo = v._odo0; v.x = v._x0; v.z = v._z0; v.heading = v._h0; v.laneCur = v._lc0; v.latExtraCur = v._le0;
                v.fx = v._fx0; v.fz = v._fz0; v.rx = v._rx0; v.rz = v._rz0; v.transition = v._tr0;
                v.mesh.position.set(v.x, v.y, v.z); v.mesh.rotation.y = v.heading;
            }
            v.speed = 0;
        }
    }

    /** squeeze past a double-parked car or a stopped player (left if possible, else right), checking oncoming traffic */
    tryBypass(v, o, isP) {
        const e = v.edge, P = this.player;
        const rx = v.rx, rz = v.rz;
        const curOff = laneOffset(e, v.laneCur) + v.latExtraCur;
        const halfW = e.halfW ?? (laneOffset(e, lanesDir(e, v.dir) - 1) + (e.laneW ?? 3.3) / 2);
        const margin = 0.6;
        let shifts;
        if (isP) {
            const l = (P.x - v.x) * rx + (P.z - v.z) * rz, el = playerExtent(P, rx, rz);
            shifts = [l - el - v.width / 2 - margin, l + el + v.width / 2 + margin];
        } else shifts = [-(e.laneW ?? 3.3) * 0.95];
        let best = null;
        for (const sh of shifts) {
            const off = curOff + sh; // lateral offset from the centreline (right of travel = +)
            if (Math.abs(off) > halfW - v.width / 2 + 0.3) continue; // stay on the carriageway
            if (Math.abs(sh) > (e.laneW ?? 3.3) * 1.5) continue;
            const contra = !e.oneway && off - v.width / 2 < medianOf(e) / 2 - 0.2;
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
        const e = v.edge; const curOff = laneOffset(e, v.laneCur) + v.latExtraCur;
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
        const P = this.player;
        const f = (P.x - v.x) * v.fx + (P.z - v.z) * v.fz;
        v.nudges = (v.nudges || 0) + 1; v.touchT = 1.0;
        const ns = v.s + (f > 0 ? -3.5 : 3.5);
        if (v.nudges <= 2 && ns > 1 && ns < v.edge.len - 1) {
            const old = v.s; v.s = ns; this.placeOnLane(v, true, 0);
            if (!this.overlapsAny(v) && playerPen(v, P) < -0.2) { v.speed = 0; return; }
            v.s = old; this.placeOnLane(v, true, 0);
        }
        v.nudges = 0;
        if (!(this.large && this.relocate(v, 250, this.bubble, true))) this.respawn(v);
    }
    /** queues that have not moved for ~20 s: recycle the head vehicle (out of the player's view if possible) */
    resolveDeadlocks() {
        const P = this.player;
        for (const v of this.vehicles) {
            if (v.parked || v.still < 18) continue;
            let h = v; const seen = this._seen || (this._seen = new Set()); seen.clear(); seen.add(v);
            while (h.leader && typeof h.leader === 'object' && h.leader !== P && !h.leader.parked && !h.leader.inactive && h.leader.still > 2 && !seen.has(h.leader)) { h = h.leader; seen.add(h); }
            let inView = false;
            if (P) { const dx = h.x - P.x, dz = h.z - P.z, d = Math.hypot(dx, dz); inView = d < 170 && (dx * P.fx + dz * P.fz) > 0.2 * d; }
            if (inView && v.still < 40) {
                if (h.leader && typeof h.leader === 'object' && h.leader !== P) h.ghost = 2.5; // let it squeeze through
                for (const s of seen) s.still = Math.min(s.still, 12);
                continue;
            }
            if (h.inactive) continue;
            if (!(this.large && this.relocate(h, 300, this.bubble, true))) this.respawn(h);
            h.still = 0; this.stats.deadlocks = (this.stats.deadlocks || 0) + 1;
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
        const lat = laneOffset(v.edge, lane) + v.latExtraCur;
        const curLat = laneOffset(v.edge, v.laneCur) + v.latExtraCur;
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
        this.onHonk(v, reason);
        const P = this.player;
        if (P && Math.hypot(P.x - v.x, P.z - v.z) < 70 && v.bubbleCd <= 0) {
            v.bubbleCd = 4;
            this.onBubble(v, reason === 'stuck' ? 'stuck' : 'honkedAt');
        }
    }

    /** the player honked: nearby drivers react */
    playerHonk(px, pz, fx, fz) {
        let reacted = 0;
        for (const v of this.near(px, pz, 28)) {
            const dx = v.x - px, dz = v.z - pz;
            const d = Math.hypot(dx, dz);
            const ahead = (dx * fx + dz * fz) / (d || 1);
            if (ahead < -0.2 && d > 10) continue;
            if (v.parked && this.rng.chance(0.3)) { this.onBubble(v, 'honkedAt'); reacted++; continue; }
            v.annoyed = 6;
            if (v.bubbleCd <= 0 && this.rng.chance(this.chaos > 0.5 ? 0.6 : 0.3)) {
                v.bubbleCd = 3;
                this.onBubble(v, 'honkedAt'); reacted++;
                if (this.rng.chance(0.4 * this.chaos)) setTimeout(() => this.honk(v, 'reply'), 300 + this.rng() * 800);
            }
            if (v.speed < 0.2 && !v.parked && this.rng.chance(0.25)) v.speed = 1.5;
        }
        this.peds.scare(px, pz, 20);
        return reacted;
    }

    /** player bumped vehicle v */
    bump(v) {
        if (v.bubbleCd <= 0) { v.bubbleCd = 4; this.onBubble(v, 'bumped'); }
        if (this.rng.chance(0.5 * this.chaos + 0.1)) this.honk(v, 'bumped');
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
            if (!(this.large && this.relocate(v, 250, this.bubble, true))) this.respawn(v);
            v.touchT = 0; n++;
        }
        this.grid.build(this.vehicles);
        return n;
    }
    /** nearest police car within r (or null) */
    policeNear(x, z, r) { let best = null, bd = r; for (const p of this.police) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; }

    dispose() { this.scene.remove(this.group); this.peds.dispose(); }
}

// ============================================================================
//  PEDESTRIANS
// ============================================================================
const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#f5d6bd'];
const CLOTHES_B = ['#1f2937', '#374151', '#7f1d1d', '#1e3a8a', '#4b5563', '#0f172a', '#78350f', '#6b21a8', '#9ca3af', '#065f46'];
const CLOTHES_S = ['#1f2937', '#334155', '#0f766e', '#1d4ed8', '#4b5563', '#7c2d12', '#facc15', '#111827'];

class Pedestrians {
    constructor(traffic, count) {
        this.t = traffic; this.rng = makeRng(traffic.buc ? 321 : 654);
        this.list = []; this.grid = new Grid(8, 11);
        this.stats = { pushes: 0 };
        this.crossCount = new Map();
        const edges = traffic.world.graph.edges.filter(e => this.ok(e));
        const cum = new Float64Array(edges.length); let wsum = 0;
        edges.forEach((e, i) => { wsum += e.len * (0.3 + Math.min(2, trafficMulOf(e))); cum[i] = wsum; });
        const pick = () => { const r = this.rng() * wsum; let lo = 0, hi = edges.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; } return edges[lo]; };
        const stops = this.stops = (traffic.world.pois || []).filter(p => p.kind === 'busstop');
        if (!edges.length) count = 0;
        // geometry
        const body = new THREE.CapsuleGeometry(0.21, 0.85, 3, 8); body.translate(0, 0.21 + 0.425, 0);
        const head = new THREE.SphereGeometry(0.13, 8, 6);
        this.bodyMesh = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial({ color: '#ffffff' }), Math.max(1, count));
        this.headMesh = new THREE.InstancedMesh(head, new THREE.MeshLambertMaterial({ color: '#ffffff' }), Math.max(1, count));
        this.bodyMesh.castShadow = true; this.bodyMesh.frustumCulled = false; this.headMesh.frustumCulled = false;
        const col = new THREE.Color(); const clothes = traffic.buc ? CLOTHES_B : CLOTHES_S;
        for (let i = 0; i < count; i++) {
            const p = { i, x: 0, z: 0, heading: 0, speed: this.rng.range(1.05, 1.6), state: 'walk', legs: [], waitT: 0, phase: this.rng() * 6, downT: 0, onRoad: false, scale: this.rng.range(0.92, 1.1) };
            if (stops.length && i < count * 0.1) {
                const st = stops[i % stops.length]; const sx = st.x ?? st.doorX, sz = st.z ?? st.doorZ;
                const a = this.rng() * 6.28, r = this.rng.range(0.4, 2.2);
                p.state = 'stand'; p.x = sx + Math.cos(a) * r; p.z = sz + Math.sin(a) * r;
                const ne = traffic.index.nearest(sx, sz, 60); p.heading = ne ? Math.atan2(-(ne.cx - sx), -(ne.cz - sz)) : 0;
                this.kerbClamp(p);
            } else {
                const e = pick(); p.e = e; p.dir = this.rng() < 0.5 ? 1 : -1; p.side = this.rng() < 0.5 ? 1 : -1;
                p.s = this.rng.range(0, e.len); this.placeWalk(p);
            }
            this.list.push(p);
            this.bodyMesh.setColorAt(i, col.set(this.rng.pick(clothes)));
            this.headMesh.setColorAt(i, col.set(this.rng.pick(SKIN)));
        }
        this.bodyMesh.count = this.headMesh.count = count;
        traffic.group.add(this.bodyMesh, this.headMesh);
        this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._p = new THREE.Vector3(); this._s = new THREE.Vector3(); this._e = new THREE.Euler(0, 0, 0, 'YXZ');
        this.buildGrid();
        this.writeMatrices(0);
    }
    /** big worlds: put a pedestrian on a sidewalk / bus stop rMin..rMax from the player */
    relocate(p, rMin, rMax, hidden) {
        const T = this.t, P = T.player; if (!P) return;
        if (p.state === 'stand' && this.stops.length) {
            for (let tries = 0; tries < 40; tries++) {
                const st = this.stops[Math.floor(this.rng() * this.stops.length)]; const sx = st.x ?? st.doorX, sz = st.z ?? st.doorZ;
                const d = Math.hypot(sx - P.x, sz - P.z); if (d < rMin || d > rMax) continue;
                const a = this.rng() * 6.28, r = this.rng.range(0.4, 2.2); p.x = sx + Math.cos(a) * r; p.z = sz + Math.sin(a) * r; this.kerbClamp(p); return;
            }
            p.state = 'walk';
        }
        const cands = T.nearEdges(420);
        for (let tries = 0; tries < 50; tries++) {
            const e = cands[Math.floor(this.rng() * cands.length)]; if (!e || !this.ok(e)) continue;
            const mx = (e.a.x + e.b.x) / 2 - P.x, mz = (e.a.z + e.b.z) / 2 - P.z; const d = Math.hypot(mx, mz);
            if (d < rMin || d > rMax) continue;
            if (hidden && d < 250 && (mx * P.fx + mz * P.fz) > 0) continue;
            p.e = e; p.dir = this.rng() < 0.5 ? 1 : -1; p.side = this.rng() < 0.5 ? 1 : -1; p.s = this.rng.range(0, e.len);
            p.state = 'walk'; p.legs = []; p.onRoad = false; p.waitT = 0; this.placeWalk(p); return;
        }
        if (!p.e) p.state = 'stand'; // nowhere to walk: just stand where we are
    }
    relocateAll() { for (const p of this.list) this.relocate(p, 0, 420, false); this.buildGrid(); this.writeMatrices(); }
    recycle() {
        const P = this.t.player; if (!P || !this.list.length) return;
        for (let k = 0; k < 10; k++) {
            this._rr = ((this._rr || 0) + 1) % this.list.length;
            const p = this.list[this._rr];
            if (p.state !== 'down' && Math.hypot(p.x - P.x, p.z - P.z) > 480) this.relocate(p, 120, 420, true);
        }
    }
    ok(e) { return !isMotorway(e) && !e.tunnel && !e.bridge && e.len > 4 && (e.sidewalk ?? 1) > 0 && e.type !== 'dn' && e.type !== 'service'; }
    off(e) { return (e.halfW ?? 6) + 1.5; }
    inset(node) { return node.edges.length >= 3 ? (node.radius ?? 6) + 1.2 : 0; }
    placeWalk(p) {
        const e = p.e; const o = (this.off(e) + (p.walkOff || 0)) * p.side;
        p.x = e.a.x + e.dirx * p.s + e.nx * o; p.z = e.a.z + e.dirz * p.s + e.nz * o;
        p.heading = Math.atan2(-e.dirx * p.dir, -e.dirz * p.dir);
    }
    /** sidewalk point on edge g at distance d from node, on side `side` */
    sidePoint(g, node, d, side) {
        const fromA = g.a === node; const s = fromA ? d : g.len - d; const o = this.off(g) * side;
        return { x: g.a.x + g.dirx * s + g.nx * o, z: g.a.z + g.dirz * s + g.nz * o, s };
    }
    buildGrid() { this.grid.build(this.list); }
    crossingAt(node) { return (this.crossCount.get(node) || 0) > 0; }
    near(x, z, r) { const out = []; this.grid.query(x, z, r, (p) => { if (Math.hypot(p.x - x, p.z - z) < r) out.push(p); }); return out; }
    /** gap from vehicle front to the nearest pedestrian on the carriageway in its path */
    obstacleGap(v, look) {
        let gap = Infinity; const half = v.length / 2;
        this.grid.query(v.x + v.fx * look * 0.5, v.z + v.fz * look * 0.5, look * 0.5 + 2, (p) => {
            if (!p.onRoad) return;
            const dx = p.x - v.x, dz = p.z - v.z; const f = dx * v.fx + dz * v.fz; if (f <= 0) return;
            const l = dx * v.rx + dz * v.rz; if (Math.abs(l) > v.width * 0.5 + 1.2) return;
            const g = f - half - 0.6; if (g < gap) gap = g;
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
            const cx = e.a.x + dx * t, cz = e.a.z + dz * t, d = Math.hypot(x - cx, z - cz), hw = (e.halfW ?? 6) + margin;
            if (d < hw && hw - d > bp) { bp = hw - d; best = { e, d, cx, cz, hw }; }
        }
        return best;
    }
    inCarriageway(p) { return !!this.roadAt(p.x, p.z, 0.4); }
    /** keep a pedestrian that is not crossing out of every carriageway: move it to the nearest kerb */
    kerbClamp(p) {
        let moved = false;
        for (let k = 0; k < 3; k++) {
            const r = this.roadAt(p.x, p.z, 0.7); if (!r) break;
            let nx = p.x - r.cx, nz = p.z - r.cz; const d = Math.hypot(nx, nz);
            if (d > 1e-3) { nx /= d; nz /= d; } else { nx = r.e.nx; nz = r.e.nz; }
            p.x = r.cx + nx * (r.hw + 0.3); p.z = r.cz + nz * (r.hw + 0.3); moved = true;
        }
        return moved;
    }
    /**
     * Vehicles are solid for pedestrians: a step that would walk into a vehicle (OBB + margin) is refused,
     * and a vehicle that moves into a pedestrian pushes it out sideways (toward the kerb). Returns true if blocked.
     */
    avoidVehicles(p, ox, oz, moved) {
        const R = 0.3, M = 0.4; let blocked = false;
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
                if (p.state === 'walk' && p.e) { // walkers follow the sidewalk line: shift that line instead
                    const e = p.e, o = ((nx - p.x) * e.nx + (nz - p.z) * e.nz) * p.side;
                    p.walkOff = clamp((p.walkOff || 0) + o, -0.6, 3); // (never pushed further into the road than 0.6 m)
                }
                p.x = nx; p.z = nz; pushed = any = true;
            });
            if (!any) break;
        }
        if (pushed) this.stats.pushes++;
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
        p.x += fx * 1.2; p.z += fz * 1.2; p.fallDir = Math.atan2(-fx, -fz);
        return true;
    }

    update(dt) {
        this.crossCount.clear();
        const T = this.t;
        this._fr = (this._fr || 0) + 1;
        for (const p of this.list) {
            p.phase += dt * p.speed * 5.5;
            if (p.state === 'down') {
                p.onRoad = true; // lying in the road: cars stop for them
                p.downT -= dt; if (p.downT <= 0) { p.state = p.prev === 'stand' ? 'stand' : (p.legs.length ? 'legs' : 'walk'); p.onRoad = false; if (p.state === 'walk' && p.e) this.placeWalk(p); }
                continue;
            }
            const ox = p.x, oz = p.z, os = p.s;
            let moved = false;
            if (p.state === 'stand') { /* waits at the stop */ }
            else if (p.state === 'walk') {
                if (!p.e) { p.state = 'stand'; continue; }
                p.s += p.speed * dt * p.dir;
                if (p.walkOff) { const k = Math.min(Math.abs(p.walkOff), 0.35 * dt); p.walkOff -= Math.sign(p.walkOff) * k; } // drift back to the sidewalk line
                const e = p.e;
                const endNode = p.dir > 0 ? e.b : e.a;
                const ins = Math.min(this.inset(endNode), e.len * 0.45);
                const sEnd = p.dir > 0 ? e.len - ins : ins;
                if ((p.dir > 0 && p.s >= sEnd) || (p.dir < 0 && p.s <= sEnd)) { p.s = sEnd; this.placeWalk(p); this.planNode(p, endNode); }
                else this.placeWalk(p);
                p.onRoad = false; moved = true;
            } else if (p.state === 'legs' || p.state === 'wait') {
                const leg = p.legs[0];
                if (!leg) { p.state = 'walk'; continue; }
                if (leg.cross && !leg.started) {
                    p.state = 'wait'; p.waitT += dt;
                    if (this.safeToCross(leg, p.waitT, p)) { leg.started = true; p.state = 'legs'; p.waitT = 0; }
                    else { p.heading = Math.atan2(-(leg.x - p.x), -(leg.z - p.z)); this.avoidVehicles(p, ox, oz, false); continue; }
                }
                const dx = leg.x - p.x, dz = leg.z - p.z; const d = Math.hypot(dx, dz);
                const sp = p.speed * (leg.cross ? 1.25 : 1);
                p.onRoad = !!leg.cross;
                if (leg.cross) this.crossCount.set(leg.node, (this.crossCount.get(leg.node) || 0) + 1);
                if (d < sp * dt + 0.05) {
                    p.x = leg.x; p.z = leg.z; p.legs.shift();
                    if (!p.legs.length) { p.state = 'walk'; p.onRoad = false; p.e = p.next.e; p.dir = p.next.dir; p.side = p.next.side; p.s = p.next.s; this.placeWalk(p); }
                } else {
                    p.x += dx / d * sp * dt; p.z += dz / d * sp * dt; p.heading = Math.atan2(-dx, -dz);
                }
                moved = true;
            }
            // vehicles are obstacles (never overlap); a walker blocked for long turns back
            // (a crossing blocked for a while by a car standing on it: walk around it — the push slides them along its side)
            if (this.avoidVehicles(p, ox, oz, moved && !(p.onRoad && (p.blockT || 0) > 2.5))) {
                if (p.state === 'walk') p.s = os;
                p.blockT = (p.blockT || 0) + dt;
                if (p.blockT > 3 && p.state === 'walk') { p.dir = -p.dir; p.blockT = 0; p.heading += Math.PI; }
            } else if (!(p.onRoad && p.blockT > 2.5)) p.blockT = Math.max(0, (p.blockT || 0) - dt);
            else { p.blockT += dt; if (p.blockT > 6) p.blockT = 0; }
            // never loiter in a carriageway (except while crossing): checked a few peds per frame
            if (!p.onRoad && (p.i + this._fr) % 30 === 0) {
                if (p.state !== 'walk') this.kerbClamp(p);
                else if (this.inCarriageway(p)) {
                    // the sidewalk line runs through another road here: turn back, then switch sides / move away
                    p.roadHits = (p.roadHits || 0) + 1;
                    if (p.roadHits === 1) { p.dir = -p.dir; p.s = os; }
                    else if (p.roadHits === 2) { p.side = -p.side; this.placeWalk(p); }
                    else { p.roadHits = 0; if (T.large) this.relocate(p, 120, 420, true); else { p.state = 'stand'; this.kerbClamp(p); } }
                } else p.roadHits = 0;
            }
        }
        this.writeMatrices(dt);
    }

    planNode(p, node) {
        const e = p.e; const fx = e.dirx * p.dir, fz = e.dirz * p.dir;
        const ts = p.side * p.dir; // +1 = walking on the right of the road relative to travel
        const opts = [];
        for (const g of node.edges) {
            if (g === e || isMotorway(g) || g.tunnel) continue;
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
            p.legs = legs; p.state = 'legs'; p.next = { e: g, dir: og, side: useA ? 1 : -1, s: P2.s };
        };
        const crossLeg = (X, legs, from) => {
            const cd = Math.min(this.inset(node) + 1.5, X.len * 0.45);
            const A = this.sidePoint(X, node, cd, 1), B = this.sidePoint(X, node, cd, -1);
            const near = Math.hypot(A.x - from.x, A.z - from.z) <= Math.hypot(B.x - from.x, B.z - from.z) ? [A, B] : [B, A];
            legs.push({ x: near[0].x, z: near[0].z });
            legs.push({ x: near[1].x, z: near[1].z, cross: true, node, edge: X });
            return near[1];
        };
        if (!opts.length) { // dead end: turn around (maybe crossing)
            p.dir = -p.dir; if (this.rng() < 0.3) { p.side = -p.side; } this.placeWalk(p); return;
        }
        const r = this.rng();
        if (opts.length === 1) {
            const o = opts[0];
            if (node.crossing && r < 0.4) { const legs = []; const land = crossLeg(e, legs, here); goWalk(o.g, o.og, land, legs); }
            else goWalk(o.g, o.og, here, []);
            return;
        }
        opts.sort((a, b) => a.ang - b.ang); // left .. right
        const corner = ts > 0 ? opts[opts.length - 1] : opts[0];
        const straight = opts.reduce((a, b) => (b.dot > a.dot ? b : a));
        const signal = node.hasLight || node.crossing;
        if (r < 0.45 || (!signal && !T_BUC(this) && r < 0.8)) goWalk(corner.g, corner.og, here, []);
        else if (r < 0.75 && straight !== corner && straight.dot > 0.5) {
            const legs = []; const land = crossLeg(corner.g, legs, here); goWalk(straight.g, straight.og, land, legs);
        } else {
            const legs = []; const land = crossLeg(e, legs, here);
            const far = ts > 0 ? opts[0] : opts[opts.length - 1];
            goWalk(far.g, far.og, land, legs);
        }
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

    writeMatrices() {
        const m = this._m, q = this._q, pos = this._p, sc = this._s, eu = this._e;
        for (const p of this.list) {
            const s = p.scale;
            if (p.state === 'down') {
                eu.set(-Math.PI / 2, p.fallDir, 0, 'YXZ'); q.setFromEuler(eu);
                pos.set(p.x, 0.26, p.z); sc.set(s, s, s); m.compose(pos, q, sc); this.bodyMesh.setMatrixAt(p.i, m);
                const hx = p.x - Math.sin(p.fallDir) * 1.45 * s, hz = p.z - Math.cos(p.fallDir) * 1.45 * s;
                pos.set(hx, 0.26, hz); m.compose(pos, q, sc); this.headMesh.setMatrixAt(p.i, m);
                continue;
            }
            const moving = p.state === 'walk' || p.state === 'legs';
            const bob = moving ? Math.abs(Math.sin(p.phase)) * 0.05 : 0;
            const sway = moving ? Math.sin(p.phase) * 0.06 : 0;
            eu.set(0, p.heading, sway, 'YXZ'); q.setFromEuler(eu);
            pos.set(p.x, 0.2 + bob, p.z); sc.set(s, s, s); m.compose(pos, q, sc); this.bodyMesh.setMatrixAt(p.i, m);
            pos.set(p.x, 0.2 + bob + 1.62 * s, p.z); m.compose(pos, q, sc); this.headMesh.setMatrixAt(p.i, m);
        }
        this.bodyMesh.instanceMatrix.needsUpdate = true; this.headMesh.instanceMatrix.needsUpdate = true;
    }
    dispose() { this.bodyMesh.geometry.dispose(); this.headMesh.geometry.dispose(); }
}
const T_BUC = (peds) => peds.t.buc;
