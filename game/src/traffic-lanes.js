// Traffic methods (split from traffic.js, spec 22; mixed into Traffic by mixin.js): transit setup, spawning and
// placement on lanes, lane geometry and route choice (turn lanes, motor turn restrictions), lane-free / bus-stop
// look-ahead and the deadlock watchdogs.
import * as THREE from '../vendor/three.module.min.js';
import * as VEH from './vehicles.js';
import { CAR_COLORS, makeVehicle } from './vehicles.js';
import { TRANSIT, TRANSIT_RE } from './data.js';
import { angleLerp, clamp, makeRng } from './util.js';
import { canTravel, canTravelBus, isMotorway, lanesDir } from './nav.js';
import { ambientTrafficAccess } from './road-access.js';
import { initialTrafficStaticClearance } from './initial-traffic-admission.js';
import { sampleTramPath, tramContinuations, tramSpan } from './tram-path.js';
import { laneTurnAllowed, preservesTurnLane } from './turn-lanes.js';
import { motorRestrictionMode, motorTurnAllowed } from './motor-turn-restrictions.js';
import { sourceRoadClearance } from './source-road-clearance.js';
import { evaluateInitialParking } from './initial-parking-behavior.js';
import { fitTramBodySupport } from './tram-body-support.js';
import { LONG_BODY, LONG_LEN, actorCanTravel, closedEdge, junctionDist, laneOffset, layerOf, padOf, pedestrianPen, playerExtent, streetLevel, trafficMulOf, tramOffset, vvPen } from './traffic-shared.js';
import { Pedestrians } from './pedestrians.js';

export class TrafficLanes {

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
        const busShare = (e) => anyRoutes ? (e.busRoute ? (this.buc ? 0.09 : 0.07) : 0.006) : (this.buc ? 0.05 : 0.03);
        const transitBus = (e) => e.trolleyWire && TK.trolley && this.rng() < 0.6 ? this.transitKind('trolleybus') : (this.transitKind('bus') || 'bus');
        const pickKind = (e) => {
            if (!isMotorway(e) && !e.tramOnly && !closedEdge(e)) {
                const pBus = busShare(e);
                if (this.rng() < pBus) return transitBus(e);
            }
            return this.carKind(e);
        };
        const plan = [];
        for (const e of edges) {
            if (e.len < 4 || closedEdge(e)) continue;
            for (const dir of [1, -1]) {
                const lanes = lanesDir(e, dir); if (!lanes) continue;
                // a bus lane against a one-way (contraflow-bus.js) carries only the buses of the street's transit share
                const busOnly = dir < 0 && !!e.contraflowBus; if (busOnly && (isMotorway(e) || e.tramOnly)) continue;
                const exp = (e.len / 55) * trafficMulOf(e) * density * lanes * (busOnly ? busShare(e) : 1);
                let n = Math.floor(exp); if (this.rng() < exp - n) n++;
                for (let i = 0; i < n; i++) plan.push(busOnly ? { e, dir, busOnly } : { e, dir });
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
        for (const { e, dir, busOnly } of plan) {
            if (this.vehicles.length >= this.maxVehicles - nPolice) break;
            const kind = busOnly ? transitBus(e) : pickKind(e);
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
        const maxParked = Math.round(this.maxVehicles * 0.2), maxTrams = 200;
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
        return lanesDir(e, dir) >= 2 && !(dir < 0 && e.contraflowBus) && !isMotorway(e) && e.type !== 'dn' && !e.roundabout && !e.tram && !e.tunnel && !e.bridge && e.len >= 40;
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
    noteRelocated(v) { if (v.edge.rail) { v.servedRailStop = null; v.servedRailStopOdo = null; v.dwell = 0; } v.sigCtl = null; v._moveGeneration = (v._moveGeneration || 0) + 1; if (this._bulk) { this._bulk.push(v); return; } const r = this._recent || (this._recent = []); r.push(v); if (r.length > 32) r.shift(); }

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
        if (e.rail) this.poseTramSections(v);
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
            if (!(v.bus && !n.rail ? canTravelBus(n, nd) : canTravel(n, nd)) || !ambientTrafficAccess(n)) continue; // (buses: also the bus lanes against a one-way)
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
        // The planned route was validated again on every step (up to 24 turn-rule lookups per vehicle). The verdict depends
        // only on the vehicle's edge, direction and lane and on the route's own legs: while those are what they were at the
        // last validation, its result stands.
        const C = v._routeChecked;
        let same = !!C && C.edge === from && C.dir === dir && C.lane === lane && C.n === R.length;
        if (same) for (let i = 0; i < R.length; i++) if (C.item[i] !== R[i] || C.e[i] !== R[i].e || C.d[i] !== R[i].dir) { same = false; break; }
        if (same) lane = C.endLane;
        else {
            for (let i = 0; i < R.length; i++) {
                const next = R[i];
                if (!this.turnLaneAllows(from, dir, lane, next, v)) { R.length = i; break; }
                lane = this.laneOnNext(v, lane, next.e, next.dir); from = next.e; dir = next.dir;
            }
            const K = C || (v._routeChecked = { item: [], e: [], d: [] });
            K.edge = v.edge; K.dir = v.dir; K.lane = v.lane; K.n = R.length; K.endLane = lane;
            for (let i = 0; i < R.length; i++) { K.item[i] = R[i]; K.e[i] = R[i].e; K.d[i] = R[i].dir; }
            K.item.length = K.e.length = K.d.length = R.length;
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
            this.respawn(v);
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
            if (!this.respawn(h)) continue;
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
}
