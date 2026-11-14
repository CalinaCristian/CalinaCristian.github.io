// Traffic methods (split from traffic-step.js, spec 13; mixed into Traffic by mixin.js): junction box reservations
// (claims across a signal controller's pads and links), exit room ("keep the box clear"), signal occupancy.
import { lanesDir } from './nav.js';
import { tramPathPolyline } from './tram-path.js';
import { laneOffset, segDist, tramOffset } from './traffic-shared.js';

/** A box occupant that has stood still this long (s), or waits this close behind another vehicle (m), no longer holds
 *  the other signal phases red: it is not clearing the box itself. */
const OCCUPANCY_STALL_S = 8, OCCUPANCY_QUEUE_GAP_M = 8;
/** A junction claim whose vehicle has stood this long (s) behind another vehicle no longer makes later cars wait. */
const CLAIM_STALL_S = 4, CLAIM_STALL_LONG_S = 12;
/** Room a car needs beyond the exit pad before it enters a box (m, on top of its own length). */
const EXIT_ROOM_M = 1.5;
/** A vehicle in the exit lane slower than this (m/s) is a queue, not traffic that will have moved on. */
const EXIT_QUEUE_SPEED = 2;
/** How long a car keeps a box clear for an exit queue that does not move (s, its own wait and the queue's). */
const EXIT_PATIENCE_S = 20;
/** A claim of a car waiting at its line holds while the car renews it (every step it waits there) within this time (s). */
const CLAIM_RENEW_S = 0.5;

export class TrafficBoxes {
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
        this.boxWaitSweep = 0;
        for (const r of list) {
            const o = r.v; if (o === v || o.inactive || r.t0 >= mine || !this.inBox(r, key)) continue;
            if (r.inE === curE && r.laneIn === path.laneIn) continue; // ahead of us in our lane: plain car-following
            // (Rosetti finale, Calea Floreasca at Str. Protopopescu) a claimant standing in a queue inside the box waits for
            // its leader, and that queue may itself wait for us (a bus turning across our lanes held up by our queue): its
            // body stays an obstacle for car-following and the overlap guard, the part of its path it has not reached
            // does not hold us.
            // (Piața Victoriei, Titulescu) so does an entered claimant that has stood still much longer, whatever holds it
            // (a walker, a light at the next head, a knot): a waiting claim with no end left the cars behind it at the line
            if (o.speed < 0.3 && (o.stuck || 0) > (o.leader && typeof o.leader === 'object' ? CLAIM_STALL_S : CLAIM_STALL_LONG_S) && (r.entered || o.leader)) continue;
            for (const a of path.segments) for (const b of r.segments) {
                const gap = segDist(a.p0x, a.p0z, a.p1x, a.p1z, b.p0x, b.p0z, b.p1x, b.p1z);
                // (a car waiting for a long body's turn stops that body's sweep short of the line: see stepVehicle)
                if (gap < (v.width + o.width) * 0.5 + 0.5 + (path.sweep || 0) + (r.sweep || 0)) { this.boxWaitSweep = r.sweep || 0; return 'wait'; }
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
    /** Reserve every pad and connecting lane through this controller, including turns. The entry edge may lie ahead of
     *  the vehicle's own edge (a link shorter than the pad it leads into: the box is claimed from the edge before). */
    reservationPath(v, curE, curDir, nxt, node, rad) {
        const path = this.boxPath(v, curE, curDir, nxt, rad);
        path.segments = path.railSegments || [{ ...path }]; path.internalEdges = new Set(); path.entryRad = rad; path.exitRad = rad; path.node = node;
        path.phase = node.sourceSignal?.phase ?? this.world.nodeLight?.[node.id]?.approaches.find(a => a.edge === curE)?.phase;
        // (Calea Floreasca at Str. Protopopescu) a long body turning sweeps well inside the chord between its entry and exit
        // lane points (off-tracking ≈ wheelbase² / 2R): its claim is that much wider, so a car does not stop in its sweep
        if (v.long && !v.tram) { const turn = Math.abs(Math.atan2(curE.dirx * curDir * nxt.e.dirz * nxt.dir - curE.dirz * curDir * nxt.e.dirx * nxt.dir, curE.dirx * curDir * nxt.e.dirx * nxt.dir + curE.dirz * curDir * nxt.e.dirz * nxt.dir)); path.sweep = turn > 0.35 ? Math.min(2, (v.length * 0.5) ** 2 / (2 * Math.max(rad, 6))) : 0; }
        // where the claim starts: index of nxt in the route and the edges the vehicle still drives before curE
        let ni = 0; const pre = new Set();
        if (curE !== v.edge) {
            ni = v.route.indexOf(nxt); if (ni < 0) ni = v.route.findIndex(r => r.e === nxt.e && r.dir === nxt.dir);
            if (ni < 0) ni = 0;
            pre.add(v.edge); for (let i = 0; i < ni - 1; i++) pre.add(v.route[i].e);
        }
        path.preEdges = pre.size ? pre : null;
        let toNode = (v.edge.len - v.s); for (let i = 0; i < ni; i++) toNode += v.route[i].e.len; // vehicle centre → entry node
        path.nodeOdo = (v.odo || 0) + toNode;
        const cl = node.lightCluster;
        let step = nxt, i = ni, exitIndex = ni;
        while (cl && step && i < v.route.length) {
            const end = step.dir > 0 ? step.e.b : step.e.a, after = v.route[++i];
            if (end.lightCluster !== cl || !after || after.uturn) break;
            path.internalEdges.add(step.e);
            const segment = this.boxPath(v, step.e, step.dir, after, end.radius ?? 6), last = path.segments[path.segments.length - 1];
            path.segments.push({ p0x: last.p1x, p0z: last.p1z, p1x: segment.p0x, p1z: segment.p0z }, segment);
            path.outE = after.e; path.outDir = after.dir; path.exitRad = end.radius ?? 6; path.lane = segment.lane; step = after; exitIndex = i;
        }
        path.exitIndex = exitIndex;
        path.generation = v._moveGeneration || 0;
        path.clearEdges = new Set(v.route.slice(exitIndex).map(r => r.e));
        path.clearOdo = path.nodeOdo + v.route.slice(ni, exitIndex).reduce((d, r) => d + r.e.len, 0) + path.exitRad + v.length * 0.5 + 1;
        return path;
    }
    /** v has entered a reservation of node's controller whose path runs through node (it is committed across it) */
    ownsBox(v, node) {
        const key = this.boxController(node), list = this.boxes.get(key); if (!list) return false;
        for (const r of list) {
            if (r.v !== v || !r.entered || !this.inBox(r, key)) continue;
            if (r.node === node) return true;
            for (const e of r.internalEdges) if (e.a === node || e.b === node) return true;
        }
        return false;
    }
    /** a reservation holds until the car's rear has left the pad (or it went elsewhere / timed out) */
    inBox(r, node) {
        const o = r.v;
        if (o.inactive || (o._moveGeneration || 0) !== r.generation || o.odo >= r.clearOdo) return false;
        // (Piața Victoriei, Kiseleff entry) a car still waiting at its line for an older claim keeps its own (renewed every
        // step): it lapsed after 6 s, was taken again as the newest claim, and every car arriving on the other approaches
        // was older than it from then on: it waited for minutes. First come, first served across the whole box.
        if (o.edge === r.inE) {
            if (o.s + o.length * 0.5 > o.edge.len - r.entryRad - 0.8) r.entered = true;
            return r.entered || this.time - r.t0 < 6 || o.speed > 0.5 || this.time - r.t < CLAIM_RENEW_S;
        }
        if (r.preEdges?.has(o.edge)) {
            // claimed from the edge before a short entry link: its front may already be inside the pad
            if ((o.odo || 0) + o.length * 0.5 > r.nodeOdo - r.entryRad - 0.8) r.entered = true;
            return r.entered || this.time - r.t0 < 6 || o.speed > 0.5 || this.time - r.t < CLAIM_RENEW_S;
        }
        if (r.internalEdges.has(o.edge)) { r.entered = true; return true; }
        if (o.edge === r.outE) { r.entered = true; return o.s - o.length * 0.5 < r.exitRad + 1; }
        // A short shape segment can end while a bus's rear still occupies the pad.
        if (r.entered && r.clearEdges.has(o.edge) && o.odo < r.clearOdo) return true;
        return false;
    }
    /**
     * Keep the box clear: room for v's whole body beyond the exit pad of its claimed path, in its exit lane. A vehicle
     * standing there (a queue spilling back from the next junction or stop) means v would stop inside the box, across
     * the other movements: it waits at the line instead. Returns the blocking vehicle, or null when there is room.
     */
    exitBlocked(v, path) {
        if (v.tram || !path?.outE || path.exitIndex == null) return null;
        const need = path.exitRad + v.length + EXIT_ROOM_M;
        let e = path.outE, dir = path.outDir, from = 0, lane = path.lane ?? 0, blocker = null;
        for (let i = path.exitIndex; e && from < need; ) {
            const nl = Math.max(1, lanesDir(e, dir));
            for (const o of this.onEdge(e)) {
                if (o === v || o.inactive || o.parked || o.dir !== dir || o.speed >= EXIT_QUEUE_SPEED) continue;
                if (nl > 1 && Math.abs((o.laneCur ?? o.lane) - Math.min(lane, nl - 1)) > 0.75) continue;
                const rear = from + o.s - o.length * 0.5;
                if (rear < need && from + o.s + o.length * 0.5 > 0) { blocker = o; break; }
            }
            if (blocker) break;
            from += e.len; const nx = v.route[++i]; if (!nx || nx.uturn) break;
            lane = this.laneOnNext(v, lane, nx.e, nx.dir); e = nx.e; dir = nx.dir;
        }
        // (Calea Floreasca: chains of cars each keeping the next box clear behind a queue that did not move for minutes)
        // keeping clear is a courtesy with a limit: once both have stood EXIT_PATIENCE_S, the car moves up into the box
        // behind it (the claims still keep it off every crossing path)
        if (blocker && (v.stuck || 0) > EXIT_PATIENCE_S && (blocker.still || 0) > EXIT_PATIENCE_S) return null; // (still: not a red-light queue)
        return blocker;
    }
    /** vehicles whose current edge is e (an index rebuilt once per frame) */
    onEdge(e) {
        if (this._onEdgeFrame !== this._frame) {
            this._onEdgeFrame = this._frame;
            const m = this._onEdge || (this._onEdge = new Map()); for (const l of m.values()) l.length = 0;
            for (const o of this.vehicles) { if (o.inactive || o.parked) continue; let l = m.get(o.edge); if (!l) m.set(o.edge, l = []); l.push(o); }
        }
        return this._onEdge.get(e) || [];
    }
    syncSignalOccupancy() {
        for (const l of this.world.lights || []) l.node.lightCluster.occupiedPhases = [];
        for (const [key, list] of this.boxes) for (const r of list) {
            if (!this.inBox(r, key) || !r.entered) continue;
            // (h-sim) the last signal controller this car was inside, and where: see SAME_CONTROLLER_M
            r.v.sigCtl = key; r.v.sigCtlOdo = r.v.odo || 0;
            // (Șoseaua Pipera cluster, Piața Romană: one controller over 8 and 15 signal nodes) a car queued in the box
            // behind a car that waits at the cluster's next signal head, or stalled in a knot, held every other phase red:
            // the car at the head of its queue never got its green and the cluster locked for the whole drive. Only a car
            // that is clearing the box on its own holds the signal; a queued or stalled one keeps its path reservation
            // (other cars still wait for it in boxCheck).
            // (Șoseaua Pipera at Gara Herăstrău) nor does one that makes no headway (≥ 1 m in OCCUPANCY_STALL_S): two cars
            // knotted in the box opened and closed their contact without getting anywhere, their stall timers kept
            // restarting, and the other phase stayed red for minutes.
            const o = r.v, L = o.leader, queued = !!L && typeof L === 'object' && (o.gap ?? Infinity) < OCCUPANCY_QUEUE_GAP_M && (o.speed || 0) < 3;
            if (o.occOdo === undefined || Math.abs((o.odo || 0) - o.occOdo) > 1) { o.occOdo = o.odo || 0; o.occT = this.time; }
            if (queued || (o.stuck || 0) > OCCUPANCY_STALL_S || this.time - o.occT > OCCUPANCY_STALL_S) continue;
            if (Number.isInteger(r.phase) && key.occupiedPhases && !key.occupiedPhases.includes(r.phase)) key.occupiedPhases.push(r.phase);
        }
    }
    pruneBoxes() {
        for (const [node, list] of this.boxes) {
            for (let i = list.length - 1; i >= 0; i--) if (!this.inBox(list[i], node)) list.splice(i, 1);
            if (!list.length) this.boxes.delete(node);
        }
    }
}
