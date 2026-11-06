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
/** width of the median (tram tracks / divider) */
export function medianOf(e) {
    if (e.median != null) return e.median;
    return e.tram ? 4.4 : (e.type === 'highway' ? 1.2 : 0);
}
/** lateral offset (to the right of travel) of lane `lane` (0 = innermost) */
export function laneOffset(edge, lane, dir = 1) { return medianOf(edge) / 2 + (edge.laneW ?? 3.3) * (lane + 0.5); }
const tramOffset = (e) => Math.max(1.0, medianOf(e) / 4);
const layerOf = (e) => (e.bridge ? 1 : 0) + (e.tunnel ? -1 : 0) + (e.layer | 0);

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
        this.chaos = city.traffic?.chaos ?? 0.5;
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
        this.stats = { updateMs: 0 };
        this._idSeq = 0;
        this.buildBusStops();
        this.spawnAll();
        this.peds = new Pedestrians(this, opts.maxPeds ?? (this.buc ? 250 : 60));
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
                    const dir = this.rng.pick([1, -1]); const lanes = lanesDir(e, dir); if (!lanes) continue;
                    const v = this.spawn({ edge: e, dir, lane: lanes - 1, s: this.rng.range(15, e.len - 15), kind: this.rng.pick(['hatch', 'sedan', 'van', 'hatch']) });
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
                    const v = this.spawn({ edge: e, dir, lane: 0, s: this.rng.range(5, e.len - 5), kind: 'tram' });
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
        const lo = this.buc ? 0.9 : 0.95, hi = this.buc ? 1.25 : 1.1;
        const v = {
            id: this._idSeq++, edge, dir, lane, s, kind, mesh,
            length: mesh.userData.length || 4.4, width: mesh.userData.width || 1.8,
            speed: 0, desiredMul: kind === 'bus' || kind === 'truck' ? this.rng.range(0.85, 0.95) : this.rng.range(lo, hi),
            stuck: 0, honkAt: this.rng.range(2.5, 7) / (0.3 + this.chaos), honkCd: 0,
            laneCur: lane, lateralExtra: 0, latExtraCur: 0, parked: false, tram: kind === 'tram', bus: kind === 'bus', isPolice: kind === 'police',
            bubbleCd: 0, annoyed: 0, route: [], ghost: 0, odo: 0, stopDone: null, stopTimer: 0, bypass: null, bypassT: 0, dwell: 0, served: null,
            x: 0, z: 0, y: 0.24, heading: 0, fx: 0, fz: 1, rx: 1, rz: 0, layer: layerOf(edge),
            laneChangeCd: this.rng.range(1, 6), leader: null, gap: Infinity,
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
        v.mesh.rotation.y = v.heading;
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
            for (const v of this.vehicles) this.relocate(v, 0, this.bubble, false);
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
        for (let tries = 0; tries < 60; tries++) {
            const e = cands[Math.floor(this.rng() * cands.length)];
            if (e.len < 8) continue;
            if (v.tram !== !!e.tram && v.tram) continue;
            if (v.parked && (isMotorway(e) || e.roundabout || e.len < 30)) continue;
            if (v.bus && isMotorway(e)) continue;
            const mul = trafficMulOf(e);
            if (this.rng() > Math.min(1, mul * 0.6 + 0.08)) continue;
            const mx = (e.a.x + e.b.x) / 2 - P.x, mz = (e.a.z + e.b.z) / 2 - P.z; const d = Math.hypot(mx, mz);
            if (d < rMin || d > rMax) continue;
            if (hidden && d < 600 && (mx * P.fx + mz * P.fz) > 0) continue; // ahead & near: would pop in view
            let dir = this.rng() < 0.5 ? 1 : -1; if (!canTravel(e, dir)) dir = -dir; if (!canTravel(e, dir)) continue;
            const lanes = lanesDir(e, dir);
            v.edge = e; v.dir = dir; v.s = this.rng.range(Math.min(4, e.len / 2), Math.max(e.len / 2, e.len - 4)); v.route.length = 0; v.layer = layerOf(e);
            v.lane = v.laneCur = v.parked || v.bus ? lanes - 1 : this.rng.int(0, lanes - 1);
            v.speed = v.parked ? 0 : Math.min(edgeSpeed(e) * 0.7, 8); v.stuck = 0; v.bypass = null; v.served = null; v.dwell = 0;
            if (!v.parked) v.latExtraCur = v.lateralExtra = 0; else v.latExtraCur = v.lateralExtra = (e.laneW ?? 3.3) * 0.55;
            this.placeOnLane(v, true, 0);
            if (Math.hypot(v.x - P.x, v.z - P.z) < 18) continue; // never on top of the player
            return true;
        }
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
        else if (lanes > lanesDir(e, v.dir) && this.buc && this.rng() < 0.4) v.lane = this.rng.int(0, lanes - 1);
        v.lane = clamp(v.lane, 0, lanes - 1);
        v.laneCur = clamp(v.laneCur, 0, lanes - 1);
        if (nx.uturn) { v.laneCur = v.lane; v.transition = 1.2; }
        else v.transition = 0.6;
    }
    /** move a vehicle somewhere else in the city, out of sight of the player */
    respawn(v) {
        if (this.large && this.relocate(v, 300, this.bubble, true)) return;
        const edges = this.world.graph.edges; const P = this.player;
        for (let tries = 0; tries < 30; tries++) {
            const e = edges[Math.floor(this.rng() * edges.length)];
            if (v.tram && !e.tram) continue;
            const dir = canTravel(e, 1) ? (canTravel(e, -1) && this.rng() < 0.5 ? -1 : 1) : (canTravel(e, -1) ? -1 : 0);
            if (!dir || e.len < 8) continue;
            const mx = (e.a.x + e.b.x) / 2, mz = (e.a.z + e.b.z) / 2;
            if (P && Math.hypot(mx - P.x, mz - P.z) < 180) continue;
            v.edge = e; v.dir = dir; v.s = this.rng.range(2, e.len - 2); v.route.length = 0; v.speed = 0; v.stuck = 0; v.layer = layerOf(e);
            v.lane = v.laneCur = clamp(v.lane, 0, lanesDir(e, dir) - 1); v.bypass = null; v.latExtraCur = v.lateralExtra = 0;
            this.placeOnLane(v, true, 0);
            return;
        }
        v.dir = -v.dir; v.s = 0; v.route.length = 0;
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
        this.peds.update(dt);
        this.recycle();
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
        this.ensureRoute(v);
        const e = v.edge, L = e.len, half = v.length / 2;
        const lim = v.tram ? 11 : edgeSpeed(e);
        let desired = lim * (v.tram ? 1 : v.desiredMul);
        const P = this.player;
        // ---------------- obstacles (cone scan via grid) ----------------
        let gap = Infinity, leader = null, leaderSpeed = 0;
        const look = clamp(10 + v.speed * 2.4, 14, 55);
        const fx = v.fx, fz = v.fz, rx = v.rx, rz = v.rz;
        const nearEnd = (L - v.s) < ((v.dir > 0 ? e.b : e.a).radius ?? 6) + 12;
        if (v.ghost > 0) v.ghost -= dt;
        else {
            this.grid.query(v.x + fx * look * 0.5, v.z + fz * look * 0.5, look * 0.5 + 8, (o) => {
                if (o === v || o === v.bypass) return;
                const dx = o.x - v.x, dz = o.z - v.z;
                const f = dx * fx + dz * fz; if (f <= 0 || f > look + o.length * 0.5) return;
                const l = dx * rx + dz * rz;
                if (Math.abs(l) > (v.width + o.width) * 0.5 + 0.3) return;
                if (o.layer !== v.layer) return;
                const hd = o.fx * fx + o.fz * fz;
                if (hd < -0.3) return; // oncoming
                let g;
                if (hd < 0.5) { if (f > 14 && !nearEnd) return; g = f - half - o.width * 0.5; } // cross traffic in junction
                else g = f - half - o.length * 0.5;
                if (g < gap) { gap = g; leader = o; leaderSpeed = hd > 0.5 ? o.speed * hd : 0; }
            });
        }
        if (P) {
            const dx = P.x - v.x, dz = P.z - v.z;
            const f = dx * fx + dz * fz, l = dx * rx + dz * rz;
            if (f > 0 && f < look + 5 && Math.abs(l) < (v.width + 1.8) * 0.5 + 0.4) { const g = f - half - 2.2; if (g < gap) { gap = g; leader = P; leaderSpeed = Math.max(0, P.speed * (P.fx * fx + P.fz * fz)); } }
        }
        const pg = this.peds.obstacleGap(v, look);
        if (pg < gap) { gap = pg; leader = 'ped'; leaderSpeed = 0; }

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
            if (v.bus) { const bs = this.busStopAhead(v, curE, curDir, D, k === -1); if (bs < stopD) { stopD = bs; } }
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
        const headway = this.buc ? 0.6 : 1.0, minGap = this.buc ? 1.6 : 2.4, b = 4.5;
        let target = Math.min(desired, vCap);
        if (gap < Infinity) target = Math.min(target, Math.sqrt(Math.max(0, leaderSpeed * leaderSpeed + 2 * b * (gap - minGap - v.speed * headway))));
        if (stopD < Infinity) target = Math.min(target, Math.sqrt(Math.max(0, 2 * b * (stopD - 0.3))));
        const accel = v.tram ? 1.2 : v.bus || v.kind === 'truck' ? 1.6 : (this.buc ? 3.0 : 2.4);
        if (target > v.speed) v.speed = Math.min(target, v.speed + accel * dt);
        else v.speed = Math.max(target, v.speed - 8.5 * dt);
        if (v.speed < 0.05) v.speed = 0;
        v.gap = gap; v.leader = leader;

        // ---------------- stuck / honking / deadlock breaking ----------------
        if (v.speed < 0.3 && desired > 1 && v.dwell === 0) {
            v.stuck += dt;
            v.honkCd -= dt;
            if (v.stuck > v.honkAt && v.honkCd <= 0 && !waitingRed) {
                v.honkCd = this.rng.range(4, 14) / (0.2 + this.chaos);
                if (this.rng.chance(0.15 + this.chaos * 0.7)) this.honk(v, 'stuck');
            }
            if (!waitingRed && leader !== P && leader !== 'ped') {
                const dP = P ? Math.hypot(P.x - v.x, P.z - v.z) : 1e9;
                if (v.stuck > 12 && dP > 150) { this.respawn(v); return; }
                if (v.stuck > 16 && leader && !(leader.parked)) { v.ghost = 2.5; v.stuck = 8; }
            }
        } else v.stuck = 0;

        // ---------------- bypass double-parked cars ----------------
        if (leader && leader.parked && gap < 12 && v.speed < 3 && !v.bypass && !v.tram) {
            const lanes = lanesDir(e, v.dir);
            if (v.lane > 0 && this.laneFree(v, v.lane - 1)) { v.lane--; v.laneChangeCd = 3; }
            else if (lanes === 1 || v.stuck > 1.5) { v.bypass = leader; v.bypassT = 7; v.lateralExtra = -(e.laneW ?? 3.3) * 0.95; if (this.chaos > 0.5 && this.rng.chance(0.3)) this.honk(v, 'lanechange'); }
        }
        if (v.bypass) {
            v.bypassT -= dt;
            const o = v.bypass; const f = (o.x - v.x) * fx + (o.z - v.z) * fz;
            if (f < -(o.length * 0.5 + half + 1) || v.bypassT <= 0 || o.edge !== v.edge && f < 0) { v.bypass = null; v.lateralExtra = 0; }
        }
        v.latExtraCur += (v.lateralExtra - v.latExtraCur) * (1 - Math.exp(-2 * dt));

        // ---------------- lane changes ----------------
        v.laneChangeCd -= dt;
        const lanes = lanesDir(e, v.dir);
        if (!v.tram && lanes > 1 && v.laneChangeCd <= 0 && !v.bypass) {
            const blocked = leader && leader !== 'ped' && gap < 25 && leaderSpeed < desired * 0.75;
            const wander = this.buc && v.speed > 4 && this.rng.chance(0.004 * this.chaos);
            let want = blocked || (v.stuck > 2 && gap < 8) || wander;
            if (v.bus && v.lane !== lanes - 1) want = true;
            if (want) {
                let options = v.bus ? [lanes - 1 > v.lane ? v.lane + 1 : v.lane - 1] : [v.lane - 1, v.lane + 1];
                options = options.filter(l => l >= 0 && l < lanes && l !== v.lane);
                if (this.rng() < 0.5) options.reverse();
                let done = false;
                for (const l of options) {
                    if (this.laneFree(v, l)) { v.lane = l; v.laneChangeCd = this.rng.range(this.buc ? 1.5 : 4, this.buc ? 5 : 10); done = true; if (this.chaos > 0.5 && this.rng.chance(0.2)) this.honk(v, 'lanechange'); break; }
                }
                if (!done) v.laneChangeCd = this.buc ? 0.6 : 1.5;
            }
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
            if (d < 1 && v.speed < 0.4 && isCurrent) {
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
        if (free && this.player) {
            const dx = this.player.x - tx, dz = this.player.z - tz;
            if (Math.hypot(dx, dz) < 8) free = false;
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
                const a = this.rng() * 6.28, r = this.rng.range(0.4, 2.2); p.x = sx + Math.cos(a) * r; p.z = sz + Math.sin(a) * r; return;
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
        const e = p.e; const o = this.off(e) * p.side;
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
        for (const p of this.list) {
            p.phase += dt * p.speed * 5.5;
            if (p.state === 'stand') continue;
            if (p.state === 'down') {
                p.downT -= dt; if (p.downT <= 0) { p.state = p.prev === 'stand' ? 'stand' : (p.legs.length ? 'legs' : 'walk'); p.onRoad = false; if (p.state === 'walk' && p.e) this.placeWalk(p); }
                continue;
            }
            if (p.state === 'walk') {
                if (!p.e) { p.state = 'stand'; continue; }
                p.s += p.speed * dt * p.dir;
                const e = p.e;
                const endNode = p.dir > 0 ? e.b : e.a;
                const ins = Math.min(this.inset(endNode), e.len * 0.45);
                const sEnd = p.dir > 0 ? e.len - ins : ins;
                if ((p.dir > 0 && p.s >= sEnd) || (p.dir < 0 && p.s <= sEnd)) { p.s = sEnd; this.placeWalk(p); this.planNode(p, endNode); }
                else this.placeWalk(p);
                p.onRoad = false;
            } else if (p.state === 'legs' || p.state === 'wait') {
                const leg = p.legs[0];
                if (!leg) { p.state = 'walk'; continue; }
                if (leg.cross && !leg.started) {
                    p.state = 'wait'; p.waitT += dt;
                    if (this.safeToCross(leg, p.waitT)) { leg.started = true; p.state = 'legs'; p.waitT = 0; }
                    else { p.heading = Math.atan2(-(leg.x - p.x), -(leg.z - p.z)); continue; }
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

    safeToCross(leg, waited) {
        const T = this.t; const node = leg.node, X = leg.edge;
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
