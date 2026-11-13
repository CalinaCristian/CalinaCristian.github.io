// Pedestrians methods (split from traffic.js, spec 22; mixed into Pedestrians by mixin.js): the road and its vehicles
// (carriageway tests, kerb clamp, vehicle avoidance, crossings and node plans) and crowd separation.
import { angleLerp, clamp } from './util.js';
import { turnAngle } from './nav.js';
import { PED_R, streetLevel } from './traffic-shared.js';

const T_BUC = (peds) => peds.t.buc;

export class PedestriansRoad {
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
        // The proposal is placed without touching the live mesh, but a tram on a graded slab is fitted to its actual emitted
        // geometry: the stand-in mesh carries that geometry and scale (without them placeOnLane threw as soon as a walker
        // stood near a moving tram on the Basarab track).
        this._yieldMesh.userData = v.mesh?.userData; this._yieldMesh.scale = v.mesh?.scale;
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
        const list = this.t.index.near(x, z, 30, this._near || (this._near = [])), boxes = this._roadBox || (this._roadBox = new Map());
        let best = null, bp = 0;
        for (const e of list) {
            if (e.tunnel || (e.ya ?? 0) > 1.5 || (e.yb ?? 0) > 1.5) continue;
            // (spec 10 load budget) the nearest point lies in the edge's bounding box: an axis gap past the wider half width
            // plus the margin (and 1 µm) cannot be a hit, so that edge is skipped (the static graph's boxes are kept here)
            let bb = boxes.get(e);
            if (bb === undefined) { const dist = this.t.world.district, wR = (dist ? e.wR : null) ?? e.halfW ?? 6, wL = (dist ? e.wL : null) ?? e.halfW ?? 6; bb = [Math.min(e.a.x, e.b.x), Math.max(e.a.x, e.b.x), Math.min(e.a.z, e.b.z), Math.max(e.a.z, e.b.z), Math.max(wR, wL)]; boxes.set(e, bb); }
            const lim = bb[4] + margin + 1e-6;
            if (bb[0] - x > lim || x - bb[1] > lim || bb[2] - z > lim || z - bb[3] > lim) continue;
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
    /** (h-sim, 2026-11-13) off the carriageway: moved elsewhere out of the player's sight, or, in view (where relocate
     *  refuses), walked to the nearest free sidewalk point as a crossing (replanWalk). Before, a refused relocation left
     *  them in the road in the walk state, walking their sidewalk line through it (Romană, George Enescu / Tache Ionescu) */
    leaveRoad(p) {
        const x = p.x, z = p.z;
        if (this.t.large) this.relocate(p, 120, 420, true); else this.relocate(p, 30, 200, true);
        if (p.x === x && p.z === z && this.roadAt(p.x, p.z, 0.4) && this.replanWalk(p)) this.stats.leaveRoadReplanned = (this.stats.leaveRoadReplanned || 0) + 1;
    }
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
        // (h-sim, 2026-11-13, Romană: Magheru at Jules Michelet / Tache Ionescu) a corner leg (not a crossing) inside or across
        // another carriageway: the walker was clamped to the kerb, walked back onto the leg and was clamped again, creeping
        // along that road for half a minute. A corner point inside a carriageway goes to the kerb; a leg whose straight line
        // still cuts a carriageway after two clamps is walked as a crossing (cars wait, no clamp), from where they stand
        const leg = moved && p.state === 'legs' && !p.onRoad ? p.legs?.[0] : null;
        if (leg && !leg.cross && !leg.recovery) {
            for (let k = 0; k < 3; k++) {
                const r = this.roadAt(leg.x, leg.z, 0.7); if (!r) break;
                let nx = leg.x - r.cx, nz = leg.z - r.cz; const d = Math.hypot(nx, nz);
                if (d > 1e-3) { nx /= d; nz /= d; } else { nx = r.e.nx; nz = r.e.nz; }
                leg.x = r.cx + nx * (r.hw + 0.3); leg.z = r.cz + nz * (r.hw + 0.3);
            }
            leg.clamps = (leg.clamps || 0) + 1;
            if (leg.clamps >= 2 && !this.roadAt(leg.x, leg.z, 0.7)) {
                p.x = ox; p.z = oz; moved = false;
                leg.cross = true; leg.started = true; leg.sx = p.x; leg.sz = p.z; leg.len = Math.hypot(leg.x - p.x, leg.z - p.z);
                p.onRoad = true; p.crossT = 0; p.legBest = undefined; p.legStall = 0;
                this.stats.cornerLegCrossings = (this.stats.cornerLegCrossings || 0) + 1;
            }
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
            // (owner, 2026-11-11, Grozavesti (477, -673): "traffic jam") a car standing still in front of the crossing is the one
            // waiting for the walker: it no longer keeps them at the kerb (a car on the crossing still does: crossBlocked)
            if (d < 5 && v.speed > .3) ok = false;
        });
        const P = this.t.player;
        if (P) { const dx = mx - P.x, dz = mz - P.z; const d = Math.hypot(dx, dz); if (d < r && Math.abs(P.speed) > 2 && (dx * P.fx + dz * P.fz) > -2) ok = false; }
        return ok;
    }
}
