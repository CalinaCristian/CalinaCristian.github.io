// Pedestrians methods (split from traffic.js, spec 22; mixed into Pedestrians by mixin.js): initial admission (walk /
// stand slots), walk planning and replanning, static obstacles, side offsets and the peer-spacing guards.
import { clamp } from './util.js';
import { deckWalkShiftAt } from './bridge-walkways.js';
import { roadSideWidth } from './nav.js';
import { collideBuildings } from './world-collide.js';
import { Grid, PED_R, pointInPoly, walkerLevel } from './traffic-shared.js';

export class PedestriansWalk {
    /** The free sidewalk slots of `edges` (each on p's side, then the other) nearest p first: the order of a stable sort
     * of every slot by distance (ties: edge, side, slot order). (spec 10 load budget) An edge side's slots are only
     * computed (walkSpace) once its lower bound could come before the next slot: its slots lie in a rectangle of the
     * edge's frame, along [lo, hi], out from the centre line [w + taper min, w + sw + taper max] (the lane-drop taper is
     * linear along the edge, world.sideExtra). Without an orthonormal frame or finite bounds an edge side is computed. */
    *slotsByDistance(p, edges) {
        const groups = [];
        for (const e of edges) for (const side of [p.side, -p.side]) groups.push({ e, side, order: groups.length, lb: this.slotBound(e, side, p.x, p.z) });
        const pending = groups.slice().sort((a, b) => a.lb - b.lb), pool = []; let gi = 0, pi = 0;
        const cmp = (a, b) => a.distance - b.distance || a.order - b.order || a.k - b.k;
        while (true) {
            let added = false;
            while (gi < pending.length && (pi >= pool.length || !(pending[gi].lb > pool[pi].distance))) {
                const g = pending[gi++], cells = this.walkSpace(g.e, g.side).cells;
                for (let k = 0; k < cells.length; k++) { const slot = cells[k], distance = Math.hypot(slot.x - p.x, slot.z - p.z); if (Number.isNaN(distance)) return yield* this.slotsBySort(p, edges); pool.push({ e: g.e, side: g.side, slot, distance, order: g.order, k }); }
                added = true;
            }
            if (added) { const rest = pool.splice(pi).sort(cmp); for (const c of rest) pool.push(c); continue; }
            if (pi >= pool.length) return;
            yield pool[pi++];
        }
    }
    /** slotsByDistance by sorting every slot (the plain form) */
    *slotsBySort(p, edges) {
        const candidates = [];
        for (const e of edges) for (const side of [p.side, -p.side]) for (const slot of this.walkSpace(e, side).cells) candidates.push({ e, side, slot, distance: Math.hypot(slot.x - p.x, slot.z - p.z) });
        candidates.sort((a, b) => a.distance - b.distance);
        yield* candidates;
    }
    /** a lower bound (with 1 µm to spare) of the distance from (x, z) to any slot of walkSpace(e, side), or 0 */
    slotBound(e, side, x, z) {
        const sides = this._walkSpace.get(e); if (sides?.has(side)) return 0; // (known: costs nothing to list)
        const dx = e.dirx, dz = e.dirz, nx = e.nx, nz = e.nz;
        if (!(Math.abs(dx * dx + dz * dz - 1) < 1e-9 && Math.abs(nx * nx + nz * nz - 1) < 1e-9 && Math.abs(dx * nx + dz * nz) < 1e-9)) return 0;
        const w = (this.t.world.district ? (side > 0 ? e.wR : e.wL) : null) ?? e.halfW ?? 6, sw = this.width(e, side);
        const lo = Math.min(this.inset(e.a), e.len * 0.45), hi = e.len - Math.min(this.inset(e.b), e.len * 0.45);
        let tmin = 0, tmax = 0;
        if (e.taperR) { const t0 = e.taperR[0], t1 = e.taperR[1]; if (!Number.isFinite(t0) || !Number.isFinite(t1)) return 0; tmin = Math.min(0, t0, t1); tmax = Math.max(0, t0, t1); }
        const px = x - e.a.x, pz = z - e.a.z, along = px * dx + pz * dz, out = (px * nx + pz * nz) * side;
        const da = Math.max(0, lo - along, along - hi), dl = Math.max(0, w + tmin - out, out - (w + sw + tmax)), d = Math.hypot(da, dl) - 1e-6;
        return Number.isFinite(d) && d > 0 ? d : 0;
    }
    /** A source sidewalk line can end inside a crossing street's carriageway.
     * Pick a clear existing sidewalk slot before first visibility, without
     * drawing another random number or changing a live person's physical pose. */
    admitInitialWalk(p) {
        if (p.live || p.state !== 'walk' || !p.e) return false;
        const radius = this.reach(p), vehicleRadius = Math.max(radius, PED_R + 0.4);
        if (this.width(p.e, p.side) > 0 && this.freeWalkPoint(p.x, p.z, radius) && this.freeVehiclePoint(p.x, p.z, vehicleRadius) && this.freePersonalSpace(p)) return false;
        const edges = [...new Set([p.e, ...this.t.index.near(p.x, p.z, 60, [])])].filter(e => this.ok(e));
        for (const { e, side, slot } of this.slotsByDistance(p, edges)) {
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
        let clear = true; const deck = this.t.world?.deckWalkLevel?.(x, z) ?? null;
        G.query(x, z, 12, v => {
            if (!clear || v.inactive || !walkerLevel(v, deck)) return;
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
        p.walkOff = (dx * e.nx + dz * e.nz) * p.side - this.off(e, p.side) - (p.dodge || 0) - this.taper(e, p.side, p.s);
    }
    /** A lane-drop taper moves the sidewalk out with the kerb (world.sideExtra): the walking line follows it. */
    taper(e, side, s) { return (e.taperR ? this.t.world?.sideExtra?.(e, side, s) || 0 : 0) + (e.deckWalkShift ? deckWalkShiftAt(e, side, s / (e.len || 1)) : 0); }
    placeWalk(p) {
        const ox = p.x, oz = p.z;
        if (this.width(p.e, p.side) <= 0 && this.width(p.e, -p.side) > 0) { p.side = -p.side; p.walkOff = 0; p.dodge = 0; p.dodgeEdge = null; }
        { const mo = this.maxOut(p.e, p.side); if ((p.walkOff || 0) > mo) p.walkOff = Math.max(mo, p.walkOff - 0.03); } // (stay on the sidewalk: back onto it at a walking pace, not in one jump)
        const e = p.e, target = this.dodgeAt(p);
        if (p.dodge === undefined || p.dodgeEdge !== e) p.dodge = target;
        else if (p.dodgeFrame !== this._fr) p.dodge += clamp(target - p.dodge, -2 * (this._stepDt || 1 / 30), 2 * (this._stepDt || 1 / 30));
        p.dodgeFrame = this._fr; p.dodgeEdge = e;
        const dg = p.dodge, o = (this.off(e, p.side) + (p.walkOff || 0) + dg + this.taper(e, p.side, p.s)) * p.side;
        p.onDodge = dg < -0.05; // (stepping round a parked car on the road side: not "lost in a carriageway")
        p.x = e.a.x + e.dirx * p.s + e.nx * o; p.z = e.a.z + e.dirz * p.s + e.nz * o;
        p.heading = Math.atan2(-e.dirx * p.dir, -e.dirz * p.dir);
        if (Math.hypot(p.x - ox, p.z - oz) > 0.25) this.recoverPose(p, ox, oz);
    }
    /** sidewalk point on edge g at distance d from node, on side `side` */
    sidePoint(g, node, d, side) {
        const fromA = g.a === node; const s = fromA ? d : g.len - d; const o = (this.off(g, side) + this.taper(g, side, s)) * side;
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
        if(B.anyBoxNear){if(!B.anyBoxNear(x,z,PED_R+.25)){p._emptyStatic={x,z};return true;}}
        else if(B.query){let candidate=false;B.query(x,z,PED_R+.25,()=>{candidate=true;});if(!candidate){p._emptyStatic={x,z};return true;}}
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
            // (owner register #67 Bellevue, L15: "pedestrian pileups at multiple closures") a closure standing across the crossing
            // both ways (turned back once, blocked again): they froze in the road for good. After 2 s they leave the carriageway
            // for a sidewalk away from the camera, like a walker pinned between cars
            else if(p.state==='legs'&&p.legs?.[0]?.back){p.staticPinT=(p.staticPinT||0)+dt;if(p.staticPinT>2){p.staticPinT=0;p.onRoad=false;p.state='walk';p.legs.length=0;this.stats.closurePinnedRelocated=(this.stats.closurePinnedRelocated||0)+1;this.relocate(p,30,200,true);return false;}}
        }
        // (owner register #67 Bellevue, L15: "pedestrian pileups at multiple closures") two flows meeting head-on on a crossing
        // refused each other's steps for good (79 of 121 walkers frozen). Someone on the carriageway blocked only by peers for
        // 1.5 s steps through them (static bodies, buildings and cars still block)
        const peerRelease = staticClear && !correction && p.onRoad && p.state === 'legs' && (p.peerBlockT || 0) > 1.5;
        if (staticClear && (peerRelease || this.peerClearStep(p, p.x, p.z, oldX, oldZ)) && (!correction || this.peerCorrectionClear(p, p.x, p.z, oldX, oldZ))) { if (peerRelease) this.stats.peerReleased = (this.stats.peerReleased || 0) + 1; p.peerBlockT = 0; this.notePeerMove(p, oldX, oldZ); return true; }
        if (staticClear) p.peerBlockT = (p.peerBlockT || 0) + dt;
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
            if (!clear || v.inactive || !walkerLevel(v, p.deckY)) return;
            const fx = -Math.sin(v.heading), fz = -Math.cos(v.heading);
            const pen = (a, b) => Math.min(v.length / 2 + PED_R - Math.abs((a - v.x) * fx + (b - v.z) * fz), v.width / 2 + PED_R - Math.abs(-(a - v.x) * fz + (b - v.z) * fx));
            const after = pen(x, z); if (after > 0 && after > pen(oldX, oldZ) + 1e-6) clear = false;
        });
        return clear;
    }
    crossingAt(node) { return (this.crossCount.get(node) || 0) > 0; }
    near(x, z, r) { const out = []; this.grid.query(x, z, r, (p) => { if (Math.hypot(p.x - x, p.z - z) < r) out.push(p); }); return out; }
}
