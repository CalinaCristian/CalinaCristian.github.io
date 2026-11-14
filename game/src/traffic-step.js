// Traffic methods (split from traffic.js, spec 22; mixed into Traffic by mixin.js): the per-vehicle step (car following,
// signals, junction boxes, lane drops), vehicle separation, overlap / pedestrian guards, bypasses and nudges.
import { clamp } from './util.js';
import { edgeSpeed, lanesDir, roadSideWidth, turnAngle } from './nav.js';
import { initialTrafficStaticClearance } from './initial-traffic-admission.js';
import { KNOT_HOLD_S, KNOT_OPEN_GAP, KNOT_YIELD_GAP, KNOT_YIELD_S, SAME_CONTROLLER_M, laneOffset, medianOf, noseInto, pedestrianPen, playerExtent, streetLevel, vpPen, vvClearance, vvPen } from './traffic-shared.js';

/** How far a knot's follower may back over the node it has just passed (m, s below 0 on its edge). */
const BACK_OVER_NODE_M = 2;
/** How far a long body's rear corner may swing into a follower's nose while it pulls away (m of overlap). */
const NOSE_SWING_M = 0.25;

export class TrafficStep {

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
        const pg = this.peds.obstacleGap(v, look, dt, inJunction);
        if (pg < gap) { gap = pg; leader = 'ped'; leaderSpeed = 0; leaderCross = false; }
        if (leader === P && P && Math.abs(P.speed) < 1.2 && gap < 14) v.blockT += dt; else v.blockT = Math.max(0, v.blockT - dt * 2);

        // ---------------- path constraints: lights, stops, zebras, turns ----------------
        const laneDropMax = this.laneDropMax(v, 60);
        if (!v.tram && v.lane > laneDropMax && this.laneFree(v, v.lane - 1)) { v.lane--; v.laneChangeCd = 2; }
        let stopD = Infinity, vCap = Infinity, waitingRed = false, stopWhy = null;
        if (e.rail && this.world.district?.inside) {
            // A source rail runs on past the district edge. The leaf rule below stops a tram at the end of the rail, which
            // lies outside: the guard then refused the tram at the edge on every step, for good. It stops inside instead.
            const ahead = this._railAhead || (this._railAhead = []);
            let before = -v.s, re = e, rd = v.dir;
            for (let k = -1; k < v.route.length && k < 1; k++) {
                if (k >= 0) { before += re.len; re = v.route[k].e; rd = v.route[k].dir; if (!re.rail) break; }
                ahead.length = 0; for (let i = k + 1; i < v.route.length && ahead.length < 4; i++) ahead.push(v.route[i]);
                const limit = this.railDistrictLimit(re, rd, v.length, v.width, ahead, k < 0 ? v.s : 0);
                if (limit < Infinity) { const d = before + limit; if (d < stopD) { stopD = Math.max(0, d); stopWhy = 'rail-district-boundary'; } break; }
            }
        }
        let curE = e, curDir = v.dir, curLane = v.lane, curLaneCur = v.laneCur, D = L - v.s - half, prevNode = null, prevD = 0;
        const seenSignals = new Set();
        let claimDone = false;
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
                // (h-sim, 2026-11-13, Romană: Piața Romană) a car that left this controller's box less than SAME_CONTROLLER_M ago
                // is still in the same movement: its reservation ends at a node outside the cluster, and the cluster's next
                // signal head (Magheru southbound, after the square) held it at red while the cars queued behind it inside the
                // box kept every other phase red (occupiedPhases): the square and Magheru locked for minutes
                const committed = (v.sigCtl === controller && (v.odo || 0) - (v.sigCtlOdo || 0) < SAME_CONTROLLER_M) || this.boxes.get(controller)?.some(r => r.v === v && this.inBox(r, controller) && r.entered);
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
            // junction box reservation: a car about to enter a box claims its path across the pad (entry lane point →
            // exit lane point, through the whole controller); a car whose path would cross / merge with a claimed one waits
            // at the line. The box claimed is the first one ahead whose pad the front has not entered: (Șoseaua Petricani at
            // Fabrica de Glucoză, 14.5 m pads on 11-13 m links) a link shorter than the pad it leads into is inside that pad
            // from its first metre, and cars that only ever claimed from the link itself entered unclaimed and locked the
            // box in a ring. A car also enters only with room for its body beyond the exit pad (keep the box clear).
            if (!claimDone && nxt && this.isJunction(node) && !nxt.uturn && D - rad >= -0.5 && (k === -1 || !curE.rail) && !this.ownsBox(v, node)) {
                claimDone = true;
                const reach = Math.max(9, v.speed * v.speed / 9 + 3);
                if (D - rad < reach) {
                    const res = this.boxCheck(v, curE, curDir, nxt, node, rad), entry = D - rad - 0.8;
                    const full = res !== 'wait' && entry > -0.3 && this.exitBlocked(v, res);                    // (Calea Floreasca at Str. Protopopescu: a van stopped at its line inside the corner a 12 m bus cut while
                    // turning in, and neither could move) a car waiting for a turning long body stops its sweep short of the line
                    const setback = res === 'wait' && this.boxWaitSweep > 0 ? this.boxWaitSweep + 1 : 0;
                    if ((res === 'wait' || full) && entry > -0.3) { if (entry - setback < stopD) { stopD = entry - setback; stopWhy = full ? 'exit-full' : 'claim'; } } // (already over the line: committed, clear the box)
                    else if (res !== 'wait' && D - rad < Math.max(4, v.speed * 0.6 + 2)) this.boxClaim(v, node, res);
                    else if (res === 'wait') this.boxClaim(v, node, this.reservationPath(v, curE, curDir, nxt, node, rad));
                }
            }
            // lane drop ahead (next edge has fewer lanes): merge before the end of this edge, or wait at the end
            // instead of being squeezed sideways onto a car in the remaining lane
            if (nxt && !v.tram && !nxt.uturn && D < 60 && !this.keepsTurnLane(curE, curDir, nxt)) {
                const nl = Math.max(1, lanesDir(nxt.e, nxt.dir));
                // (Rosetti finale, Calea Floreasca 3 → 2 lanes) steering needs travel: a car held at the line still half in
                // the ending lane could never finish its merge and stood there for good. Once it has waited there (≥ 3 s)
                // the hold is released for this node while the lane it merges into is free beside it: it merges on the move
                // at a crawl, car-following and the junction claim keep it off the others. (Releasing it only while v.stuck
                // stayed high re-held it after every centimetre.)
                if (k === -1 && (v.dropGo === node || (v.stuck >= 3 && (v.stopWhy === 'lanedrop' || v.stopWhy === 'lanedrop2') && v.stopD < 2))) {
                    const into = Math.min(curLane > nl - 1 ? nl - 1 : v.lane, Math.max(0, lanesDir(curE, curDir) - 1));
                    v.dropGo = Math.round(v.laneCur) === into || this.laneFree(v, into) ? node : null;
                }
                // (Calea Floreasca 3 → 2 lanes behind a 9 m link: a bus held for minutes) the same for a drop at a node beyond
                // the next one: the link before it is shorter than the pad, so the car never stands on it to be released
                // there. It goes once its own lane fits the narrower road or the lane it merges into is free beside it.
                else if (k >= 0 && v.dropAhead !== node && v.stuck >= 3 && (v.stopWhy === 'lanedrop' || v.stopWhy === 'lanedrop2') && Math.abs(v.stopD - (D - rad - 1.5)) < 0.3) {
                    if (Math.round(v.laneCur) <= nl - 1 || this.laneFree(v, Math.min(nl - 1, Math.max(0, lanesDir(e, v.dir) - 1)))) v.dropAhead = node;
                }
                if (v.dropGo === node || v.dropAhead === node) vCap = Math.min(vCap, 3);
                else if (curLane > nl - 1) {
                    // wait for a gap before the line; already at / past it (or waited long): merge on the move,
                    // car-following and the junction claim keep it off the others (a stop inside the box locks the junction)
                    if (D - rad - 1.5 > -0.5) { const _d = D - rad - 1.5; if (_d < stopD) { stopD = _d; stopWhy = 'lanedrop'; } }
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
        // (Calea Floreasca at Str. Protopopescu: a car's nose in the rear of a 12 m bus that swung it while turning, both
        // locked for minutes) a car hangs back behind a long body that is turning
        const swing = leader && typeof leader === 'object' && leader !== P && leader.long && Math.abs(Math.sin(leader.heading - v.heading)) > 0.3 ? 2.5 : 0;
        const headway = this.buc ? 0.6 : 1.0, minGap = (leader === P ? 2.2 : (this.buc ? 1.6 : 2.4)) + swing, b = 4.5;
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
        this.ringBackStep(v, dt); // (traffic-knots.js: backing out of a closed waiting ring)
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
                    // (Rosetti finale: a 12 m bus turning off Calea Floreasca, a follower's nose 4 cm in its rear) a body with a
                    // nose already in its rear or side (its own nose free) may take a step that brings its rear corner a little
                    // further in (≤ NOSE_SWING_M overlap in all): the first step from rest swings a long body back onto its path (here
                    // 0.19 m and 0.17 rad after the recovery translations), and refusing it froze the bus, the junction and
                    // both queues for good. The follower then opens the contact as usual.
                    const apart = (p0 > 0.05 && p < p0 + 0.04 && Math.hypot(v.x - o.x, v.z - o.z) > Math.hypot(v._x0 - o.x, v._z0 - o.z) + 0.005) ||
                        (p0 > 0 && p < NOSE_SWING_M && noseInto(o, v) && !noseInto(v, o));
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
                // converging noses have no follower either: one of them keeps yielding (the same one, once chosen). (Rosetti
                // finale, Calea Floreasca at Str. Călinescu) so do two noses meeting head-on (a left turn cutting into the
                // oncoming lane): the follower chosen afresh every frame made both open the gap and drive into each other
                // again, for minutes
                const headOn = vn && Math.cos(v.heading - hit.heading) < -0.7;
                if (vn && hn && (headOn || Math.abs(Math.sin(v.heading - hit.heading)) > .35)) fol = v.yieldT > 0 && v.yieldTo === hit ? v : hit.yieldT > 0 && hit.yieldTo === v ? hit : v.id > hit.id ? v : hit;
                crossing = (vn || hn) && (headOn || Math.abs(Math.sin(v.heading - hit.heading)) > .35); }
            if (fol.parked || fol.tram) fol = fol === v ? hit : v;
            if (fol.parked) {
                // two parked cars inside each other (placed / respawned onto one another): move one away, out of view
                if (!fol.service && (fol === v ? hit : v).parked && P) { const dx = fol.x - P.x, dz = fol.z - P.z, d = Math.hypot(dx, dz); if (d > 70 || (d > 30 && dx * P.fx + dz * P.fz < 0)) { this.respawn(fol); this.stats.unstuck = (this.stats.unstuck || 0) + 1; } }
                continue;
            }
            const other = fol === v ? hit : v;
            // (Rosetti finale: a car waiting for the next light just past the junction where a bus turns across its tail) a
            // follower that only touches the other's side and drives away from it is not held (its own steps still pass the
            // guard above): holding it kept it in the turning bus's way for good
            if (!crossing && !noseInto(fol, other) && vvPen(fol, other, fol.x - Math.sin(fol.heading) * 0.3, fol.z - Math.cos(fol.heading) * 0.3) < vvPen(fol, other) - 0.01) continue;
            fol.speed = 0; fol.zeroWhy = (opening ? 'ovOpen:' : 'ovFol:') + (other.kind || '') + '#' + other.id; if (!opening) fol.ovT = (fol.ovT || 0) + dt;
            const yields = (a, b) => { if (!crossing || a.tram) return; a.yieldTo = b; a.yieldT = KNOT_YIELD_S; if (b.yieldTo === a) b.yieldT = 0; };
            const back = Math.min(hp + (opening ? (crossing ? KNOT_YIELD_GAP : KNOT_OPEN_GAP) : 0.05), 0.8 * dt);
            let separated = false;
            // (Rosetti finale: an estate whose nose touched a turning bus's side, a crossover that had just entered Calea
            // Floreasca beside a bus turning off Ceaikovski) a car that has only just passed a node may back over it: its
            // body still stands on the pad it came from (pathPoint follows the previous link behind s = 0). Refusing every
            // step at s < 0.3 froze both bodies of such a knot for minutes, with the junction and the queues behind them.
            const overNode = (a) => a.s - back > -BACK_OVER_NODE_M && !!(a.dir > 0 ? a.edge.a : a.edge.b)?.edges && !!this.prevLink(a, a.edge, a.dir, (a.hist?.length ?? 0) - 1);
            const canBack = (a) => (a.s - back > 0.3 || overNode(a)) && !a.tram && !a.parked && !(P && Math.hypot(P.x - a.x, P.z - a.z) < 12 && vpPen(a, P) > -0.4 && (P.x - a.x) * -Math.sin(a.heading) + (P.z - a.z) * -Math.cos(a.heading) < 0);
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
                if (hidden) { fol.ovT = 0; this.respawn(fol); this.stats.unstuck = (this.stats.unstuck || 0) + 1; }
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
            if (v.s + d > v.edge.len - 0.2) continue;
            if (v.s + d < 0.2 && !(v.s + d > -BACK_OVER_NODE_M && (v.dir > 0 ? v.edge.a : v.edge.b)?.edges && this.prevLink(v, v.edge, v.dir, (v.hist?.length ?? 0) - 1))) continue; // (back over the node it has just passed, as a knot's follower does)
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
        // (2026-11-13, harness foot run in Floreasca: a hatch 1.1 m beyond Strada Garibaldi's kerb) where the car settles is its
        // target lane plus the shift; a stopped car has not yet moved to that lane (it steers only while moving), so a shift
        // that fits from where it stands (still in lane 1) could end beyond the kerb once it rolls into lane 0. Both fit now.
        const finOff = laneOffset(e, v.lane, v.dir) + v.latExtraCur, outside = o => o + v.width / 2 > right + 0.3 || o - v.width / 2 < -left - 0.3;
        let best = null;
        for (const sh of shifts) {
            const off = curOff + sh; // lateral offset from the centreline (right of travel = +)
            if (outside(off) || outside(finOff + sh)) continue; // stay on the carriageway, now and where the car settles
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
        this.respawn(v);
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
}
