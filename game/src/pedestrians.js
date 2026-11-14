// Pedestrians (split from traffic.js, spec 22; traffic.js re-exports the class).
import * as THREE from '../vendor/three.module.min.js';
import { makeRng, clamp } from './util.js';
import { makeCrowd } from './crowd.js';
import { isMotorway } from './nav.js';
import { collideBuildings } from './world-collide.js';
import { relocationPeerQuery } from './pedestrian-relocation-peers.js';
import { Grid, trafficMulOf, sidewalkWidthOf, sourceSideWidth, PED_R, DISTRICT_LOD_WALKER_M, DISTRICT_LOD_WALKER_FAR_M } from './traffic-shared.js';
import { mixin } from './mixin.js';
import { PedestriansWalk } from './pedestrians-walk.js';
import { PedestriansRoad } from './pedestrians-road.js';

// ============================================================================
//  PEDESTRIANS
// ============================================================================
const SKIN = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#f5d6bd'];
const CLOTHES_B = ['#1f2937', '#374151', '#7f1d1d', '#1e3a8a', '#4b5563', '#0f172a', '#78350f', '#6b21a8', '#9ca3af', '#065f46'];
const CLOTHES_S = ['#1f2937', '#334155', '#0f766e', '#1d4ed8', '#4b5563', '#7c2d12', '#facc15', '#111827'];
/** Walkers are drawn between their simulated positions (writeMatrices), so at 45 fps and above even a near walker is
 * simulated every other frame and a far one every fourth; a walk of 1.3 m/s is a few centimetres per step either way. */
const walkerStride = (tier, dt) => Math.max(1, Math.min(tier ? 4 : dt <= 0.0225 ? 2 : 1, Math.floor(0.08 / dt + 1e-6)));
/** Share of a sidewalk's standing cells that relocation may fill with walkers (see Pedestrians.relocate). */
const WALK_FILL = 0.35;
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
            const p = { i, x: 0, z: 0, heading: 0, speed: this.rng.range(1.05, 1.6), state: 'walk', legs: [], waitT: 0, phase: this.rng() * 6, downT: 0, onRoad: false, scale: this.rng.range(0.92, 1.1), get bubbleY() { return (Number.isFinite(this._fy) ? this._fy : 0) + 0.25 + 1.75 * this.scale; } }; // (just above the head, from the drawn feet) // (bubbleY: chat bubbles sit just above the head, not at the 2.6 m driver height)
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
    relocate(p, rMin, rMax, hidden, maxTries = 50) {
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
                // The cells are standing room (three abreast every 1.8 m on a 3.5 m sidewalk). Walkers are brought in only up
                // to WALK_FILL of that: filled to the last cell, two streams of solid bodies could not pass each other and the
                // whole population (kept within 230 m of the player in a district) jammed the few sidewalks under a viaduct.
                const free = Math.max(0, Math.ceil(space.cells.length * WALK_FILL) - load);
                if (!free) continue;
                total += free * (0.2 + Math.min(0.8, trafficMulOf(e) * 0.45));
                cands.push({ e, side, space, total });
            }
        }
        for (let tries = 0; total > 0 && tries < maxTries; tries++) {
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
        if (!(total > 0)) this.noWalkRoomUntil = (T.time || 0) + 3; // every sidewalk in range is at its walking fill: nobody else fits either
        Object.assign(p, saved);
        if (!p.e) p.state = 'stand'; // nowhere to walk: just stand where we are
    }
    recycle() {
        const P = this.t.player; if (!P || !this.list.length) return;
        if (this.noWalkRoomUntil > this.t.time) return; // (see relocate: no free walking room near the player a moment ago)
        for (let k = 0; k < 10; k++) {
            this._rr = ((this._rr || 0) + 1) % this.list.length;
            const p = this.list[this._rr];
            // districts (~1 km²): keep the walkers around the player (a busy street at noon), big legacy maps as before
            const far = 230;
            if (p.state !== 'down' && Math.hypot(p.x - P.x, p.z - P.z) > far && !(p.recycleAfter > this.t.time)) {
                // One attempt per step, a few placements each, and a walker that found no room waits before asking again:
                // with sidewalks at their walking fill every attempt scanned all sidewalks within 420 m and the whole crowd,
                // up to ten walkers a step and fifty placements each (8 % of the traffic step).
                const x = p.x, z = p.z; this.relocate(p, 45, 200, true, 8);
                if (p.x === x && p.z === z) p.recycleAfter = this.t.time + 15;
                break;
            }
        }
    }
    width(e, side, fallback = 3) { const w = sidewalkWidthOf(this.t.world, e, side, fallback); return w > 0 ? w : this.separateSidewalk(e, side); }
    /** (2026-11-13, Bellevue: 132 of 180 walkers piled on three junction stubs) OSM `sidewalk=separate` (270 of Bellevue's 305
     *  streets) maps the sidewalk as its own way beside the road; the road then has no sidewalk band, so the crowd had almost
     *  nowhere to walk. Such a side counts as a 1.8 m sidewalk just beyond the kerb, where the separate way runs. */
    separateSidewalk(e, side) {
        const cache = this._sepSide || (this._sepSide = new Map()); let v = cache.get(e);
        if (v === undefined) {
            const t = this.t.world?.data?.roadSourceGeometry?.[e.road]?.tags || {}, sep = k => /separate/.test(t[k] || '');
            const both = sep('sidewalk') || sep('sidewalk:both');
            v = { r: both || sep('sidewalk:right'), l: both || sep('sidewalk:left') }; cache.set(e, v);
        }
        return (side > 0 ? v.r : v.l) ? 1.8 : 0;
    }
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
            const ut = u + this.taper(e, side, s), x = e.a.x + e.dirx * s + e.nx * ut * side, z = e.a.z + e.dirz * s + e.nz * ut * side; // (u stays relative to the nominal kerb: placeWalk adds the taper)
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

    update(frameDt) {
        this.crossCount.clear();
        const T = this.t, dt = frameDt;
        this._stepDt = dt;
        this._fr = (this._fr || 0) + 1;
        // district level of detail (see DISTRICT_LOD_WALKER_M): a far walker takes every other frame, with twice the step
        const lod = (typeof T.viewerTier === 'function') && T.districtLod !== false;
        const strideOf = p => lod ? walkerStride(T.viewerTier(p.x, p.z, DISTRICT_LOD_WALKER_M, DISTRICT_LOD_WALKER_FAR_M), frameDt) : 1;
        const skipped = p => { const n = strideOf(p); return n > 1 && (this._fr + p.i) % n !== 0; };
        this.stats.lodWalkers = 0;
        this.ensurePeerGrid(true);
        for (const p of this.list) {
            const stride = strideOf(p);
            if (stride > 1) { this.stats.lodWalkers++; if ((this._fr + p.i) % stride !== 0) continue; }
            p.drawStride = stride;
            const dt = frameDt * stride; // (shadows the frame step for this walker's whole move)
            this._stepDt = dt;
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
                if (p.recovery === q && Math.hypot(q.x - p.x, q.z - p.z) < 0.08) { p.state = q.state; p.onRoad = q.onRoad; p.legs = q.legs; p.recovery = null; p.recBest = undefined; if (p.state === 'walk' && p.e) this.syncWalkPose(p); }
                // (owner register #67, Bellevue, checked live 2026-11-11: walkers walking back to a recovery point blocked by
                // stopped cars and other walkers stood there for minutes, and the cars waited for them) no headway for 3 s: on
                // the road they leave it, elsewhere they take up the recovered pose
                else if (p.recovery === q) {
                    const left = Math.hypot(q.x - p.x, q.z - p.z);
                    if (p.recBest === undefined || left < p.recBest - 0.15) { p.recBest = left; p.recStall = 0; } else p.recStall = (p.recStall || 0) + dt;
                    if (p.recStall > 3) {
                        p.recBest = undefined; p.recStall = 0; this.stats.recoveryStallResolved = (this.stats.recoveryStallResolved || 0) + 1;
                        if (p.onRoad || this.roadAt(p.x, p.z)) { p.recovery = null; p.onRoad = false; p.state = 'walk'; p.legs = []; this.leaveRoad(p); }
                        else { p.state = q.state; p.onRoad = q.onRoad; p.legs = q.legs; p.recovery = null; if (p.state === 'walk' && p.e) this.syncWalkPose(p); }
                    }
                }
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
                // (h-sim) placeWalk may have started a recovery walk across a carriageway (recoverPose sets onRoad): keep it,
                // so cars wait for them and the walk back counts as being on the road
                if (!p.recovery) p.onRoad = false;
                moved = true;
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
                if (p.legBest === undefined || d < p.legBest - 0.15) { p.legBest = d; p.legStall = 0; } else p.legStall = (p.legStall || 0) + dt;
                // (owner register #67, Bellevue, checked live 2026-11-11: 36 walkers stood mid-crossing for a minute beside cars
                // still for over two minutes; the cars waited for them and they could not pass the cars) a crossing without
                // headway for 2.5 s turns back to the kerb it came from; one stuck on the way back as well leaves the road
                if (leg.cross && p.legStall > 2.5 && leg.sx !== undefined) {
                    p.legBest = undefined; p.legStall = 0;
                    if (!leg.back) { leg.x = leg.sx; leg.z = leg.sz; leg.back = true; p.legs.length = 1; if (p.next) p.next.dir = -p.next.dir; this.stats.crossStallTurned = (this.stats.crossStallTurned || 0) + 1; }
                    else { p.onRoad = false; p.state = 'walk'; p.legs.length = 0; this.stats.crossStallRelocated = (this.stats.crossStallRelocated || 0) + 1; this.leaveRoad(p); continue; }
                }
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
                // (h-sim, 2026-11-13, Romană: Magheru at C. A. Rosetti) pushed off the line toward the road (walkOff < 0, kept by
                // syncWalkPose after a recovery): the walk back drifted at 0.35 m/s, so the turn-back / replan below sent them
                // across the carriageway again and again. They first sidestep onto their line at a walking pace
                else if (!p.onDodge && (p.walkOff || 0) < -0.25 && p.walkGoal === undefined && this.inCarriageway(p)) { p.walkGoal = 0; p.passT = 0; }
                else if (!p.onDodge && this.inCarriageway(p)) {
                    // the sidewalk line runs through another road here: turn back, then switch sides / move away
                    p.roadHits = (p.roadHits || 0) + 1;
                    if (p.roadHits === 1) { p.dir = -p.dir; p.s = os; }
                    else if (p.roadHits === 2 && this.width(p.e, -p.side) > 0) { const x = p.x, z = p.z; p.side = -p.side; this.placeWalk(p); this.recoverPose(p, x, z); }
                    else { p.roadHits = 0; this.leaveRoad(p); } // (standing them at the kerb piled them up on one spot)
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
                    // (owner, 2026-11-11, Grozavesti (477, -673): "traffic jam") pinned both ways (the way back is blocked too): the cars
                    // wait for them for good; they leave the carriageway (back onto a sidewalk away from the camera)
                    else if (leg.cross && leg.back) { this.stats.pinnedRelocated = (this.stats.pinnedRelocated || 0) + 1; p.onRoad = false; p.state = 'walk'; p.legs.length = 0; this.leaveRoad(p); continue; }
                    else if (!leg.cross) { p.legs.shift(); if (!p.legs.length && p.next) { const qx = p.x, qz = p.z; p.state = 'walk'; p.onRoad = false; p.e = p.next.e; p.dir = p.next.dir; p.side = p.next.side; p.s = p.next.s; this.placeWalk(p); this.adoptLine(p, qx, qz); } }
                }
                if (leg && leg.cross && leg.sx !== undefined && p.crossT > 5 + (leg.len || 10) / 1.2 && !leg.back) {
                    leg.back = true; leg.x = leg.sx; leg.z = leg.sz; p.blockT = 0;
                    p.legs.length = 1; p.next = { e: p.e, dir: -p.dir, side: p.side, s: p.s };
                }
            }
            } finally { this.guardPeerStep(p, frameX, frameZ, dt); }
        }
        this._stepDt = dt;
        this.ensurePeerGrid(true);
        this.separate(dt);
        // Crowd separation also changes the physical pose. A sidestep must not
        // finish inside a pole/car that was cleared earlier in this update.
        for (const p of this.list) if (p.state !== 'down') {
            if (skipped(p)) continue;
            this.ensurePeerGrid(); const x = p.x, z = p.z;
            this.avoidVehicles(p, p.x, p.z, false); this.clearObstacles(p); this.guardPeerStep(p, x, z, dt);
        }
        this.ensurePeerGrid();
        if (this._fr % 15 === 0) this.countObstacleOverlaps();
        this.writeMatrices(dt);
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

    writeMatrices(dt = 0) {
        const C = this.crowd;
        const wx = this.t.weatherKind ?? globalThis.game?.wxKind; if (wx !== undefined && wx !== C.weather) C.setWeather(wx);
        // feet on the raised sidewalk where the district has one (world.walkTop, 2026-11-08), else the legacy 0.2 m;
        // re-sampled when the walker has moved ≥ 0.5 m
        const wt = this.t.world?.walkTop;
        const footY = (p) => { if (!wt) return 0.2; if (p._fyx === undefined || Math.abs(p.x - p._fyx) + Math.abs(p.z - p._fyz) > 0.5) { const h = wt(p.x, p.z); p._fy = h === null ? 0.2 : h + 0.01; p._fyx = p.x; p._fyz = p.z; } return p._fy; };
        for (const p of this.list) {
            const s = p.scale;
            if (p.state === 'down') { p.drawX = undefined; C.set(p.i, { x: p.x, y: footY(p), z: p.z, scale: s, down: true, fallDir: p.fallDir }); continue; }
            // A walker simulated every n-th frame is drawn on the way from where it was drawn to where it now is, arriving as
            // its next step is taken; one simulated every frame is drawn where it is, as before. A jump (relocation) is not eased.
            if (p.drawToX !== p.x || p.drawToZ !== p.z) { p.drawFromX = p.drawX ?? p.x; p.drawFromZ = p.drawZ ?? p.z; p.drawToX = p.x; p.drawToZ = p.z; p.drawT = 0; if (Math.hypot(p.x - p.drawFromX, p.z - p.drawFromZ) > 1.5) { p.drawFromX = p.x; p.drawFromZ = p.z; } }
            { const n = p.drawStride > 1 ? p.drawStride : 1, t = n > 1 ? Math.min(1, (p.drawT = (p.drawT || 0) + 1) / n) : 1; p.drawX = p.drawFromX + (p.x - p.drawFromX) * t; p.drawZ = p.drawFromZ + (p.z - p.drawFromZ) * t; }
            const k = dt > 0 ? 1 - Math.exp(-8 * dt) : 1;
            const vx = dt > 0 && p.animX !== undefined ? (p.x - p.animX) / dt : 0, vz = dt > 0 && p.animZ !== undefined ? (p.z - p.animZ) / dt : 0;
            p.animVX = (p.animVX || 0) + (vx - (p.animVX || 0)) * k; p.animVZ = (p.animVZ || 0) + (vz - (p.animVZ || 0)) * k;
            p.animX = p.x; p.animZ = p.z;
            const talking = p.talkT > 0, speed = Math.hypot(p.animVX, p.animVZ), amp = talking || speed < 0.12 ? 0 : Math.min(1, speed / p.speed), moving = amp > 0;
            p.phase += Math.min(speed, p.speed * 1.25) * dt * 5.5;
            const bob = moving ? Math.abs(Math.sin(p.phase)) * 0.03 * amp : 0;
            C.set(p.i, { x: p.drawX, y: footY(p) + bob, z: p.drawZ, yaw: p.heading, phase: p.phase, amp, scale: s, pose: talking ? (p.talkWave > 0 ? 4 : 7) : moving ? 0 : (p.pose || 0), prop: moving || talking ? null : (p.prop || null) });
        }
    }
    dispose() { this.crowd.dispose(); }
}
mixin(Pedestrians, PedestriansWalk, PedestriansRoad);
