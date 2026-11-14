import * as THREE from '../vendor/three.module.min.js';
import { makeCockpit } from './vehicles.js';
import { collideBuildings } from './world-collide.js';
import { clamp, damp, lerp } from './util.js';
import { roadWidthAt } from './nav.js';
import { playerBodySampler } from './player-body-interval.js';

const GROUND_Y = 0.24;   // road surface top at street level (world Y.road)
const SLAB_STEP = 0.2;  // a source bridge junction's drawn top this far above the road heights is the surface (player.surfaceAt)
const MAX_STEP = 0.9;    // bigger height jumps between frames = deck edge / trench wall (not drivable)
const WHEELBASE = 2.7;   // m, for the bicycle model
const LOOK_YAW = 150 * Math.PI / 180, LOOK_PITCH = 40 * Math.PI / 180;

/** Arcade car with a first-person cockpit camera. */
export class Player {
    constructor(scene, camera) {
        this.scene = scene; this.camera = camera;
        this.x = 0; this.z = 0; this.heading = 0; // heading: 0 = facing -z (north)
        this.speed = 0; this.steer = 0; this.steerVisual = 0;
        this.rig = new THREE.Group();
        this.cockpit = makeCockpit();
        this.rig.add(this.cockpit);
        this.camHolder = new THREE.Group();
        this.camHolder.rotation.order = 'YXZ'; // head: yaw, then pitch
        this.camHolder.position.set(-0.3, 1.36, -0.45); // driver seat (left-hand drive)
        this.rig.add(this.camHolder);
        this.camHolder.add(camera);
        camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); // camera looks toward -z = car forward
        // rear-view mirror: a small plane in front of the camera showing a render from a rear camera
        this.mirrorTarget = new THREE.WebGLRenderTarget(384, 128);
        this.mirrorTarget.texture.colorSpace = THREE.LinearSRGBColorSpace;
        this.mirrorCam = new THREE.PerspectiveCamera(40, 3, 0.5, 150); // far 200 m: the mirror is small, distant blocks cost draw calls (render, spec 17)
        this.mirrorCam.position.set(0.3, 1.5, 0.3); this.mirrorCam.rotation.set(0, Math.PI, 0);
        this.rig.add(this.mirrorCam);
        const mirrorMat = new THREE.MeshBasicMaterial({ map: this.mirrorTarget.texture, toneMapped: false });
        mirrorMat.map.repeat.x = -1; mirrorMat.map.offset.x = 1; // mirror flip
        this.mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.11), mirrorMat);
        this.mirror.position.set(0.04, 1.68, -1.5); // fixed to the car (not the head), at the end of the cockpit's mirror stalk
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: '#15171a' }));
        frame.position.z = -0.011; this.mirror.add(frame);
        this.mirror.traverse((o) => o.layers.set(1));
        this.rig.add(this.mirror);
        // the cockpit's mirror mount (R17.2): glass on the stalk inside the windshield, camera centred
        const mm = this.cockpit?.userData?.mirrorMount;
        if (mm) {
            this.mirror.position.copy(mm.position); this.mirror.quaternion.copy(mm.quaternion); this.mirror.scale.set(mm.width / 0.33, mm.height / 0.11, 1);
            this.mirrorCam.position.copy(mm.camPosition); this.mirrorCam.rotation.copy(mm.camRotation); this.mirrorCam.fov = mm.camFov; this.mirrorCam.updateProjectionMatrix();
        }
        this.mirrorEnabled = true; this.driveRigShown = true;
        scene.add(this.rig);
        this.length = 4.4; this.width = 1.8; this.radius = 1.1;
        // (2026-11-08, owner: "the car still goes halfway into things before the collision") the body the driver sees runs
        // 3.42 m ahead of the eye (the rig origin) to the bonnet's nose and 2.36 m back to the boot; the collision body was a
        // 4.4 m box centred on the eye, so the visible nose went ≈ 1.2 m into a fence before anything touched
        { const ex = this.cockpit?.userData?.extent; this.front = ex?.front ?? 2.2; this.rear = ex?.rear ?? 2.2; this.width = (ex?.half ?? 0.9) * 2; this.length = this.front + this.rear; }
        this.bob = 0; this.shake = 0; this.collisionCd = 0;
        this.maxSpeed = 36; // m/s (~130 km/h)
        this.lookBack = false;
        this.look = { yaw: 0, pitch: 0, idle: 0, straight: 0, yawCur: 0, baseYaw: 0 };
        this.debug = { lastCollider: null, hits: [], count: 0 };
        this.bounds = null; this.world = null; this.traffic = null;
        this.onCollide = () => { };
    }
    /** put the car at (x, z); pass the road edge when known so the right layer (deck / street / tunnel) is used */
    place(x, z, heading, edge = null) { this.mirrorWarm = 3; // the mirror texture is stale (dark) after a load / teleport: render it the next 3 frames
        this.x = x; this.z = z; this.heading = heading; this.speed = 0;
        this.surfY = undefined; this.supportEdge = null; this.y = undefined;
        if (edge && edge.ya !== undefined) {
            const dx = edge.b.x - edge.a.x, dz = edge.b.z - edge.a.z, L2 = dx * dx + dz * dz || 1;
            const t = clamp(((x - edge.a.x) * dx + (z - edge.a.z) * dz) / L2, 0, 1);
            this.surfY = GROUND_Y + (edge.sourceBridgeGrade?.known ? edge.sourceBridgeGrade.heightAtWorld(x, z) : edge.ya + (edge.yb - edge.ya) * t); this.supportEdge = edge;
        } else if (this.world) { this._placeHeading = heading; const s0 = this.surfaceAt(x, z, null); this._placeHeading = undefined; this.surfY = s0.h; this.supportEdge = s0.edge; }
        this.updateRig(0);
        // Build immutable cockpit triangle/part caches while placement is
        // already loading/relocating the car, before the first bridge probe.
        playerBodySampler(this);
    }
    /**
     * Mouse / touch look. dx, dy = pointer movement (px) since the last frame; held = the look gesture is active
     * (pointer locked / right button held / finger down). The head returns to centre when the gesture ends, or
     * after 2 s of driving straight without moving the mouse.
     */
    applyLook(dx, dy, held, dt, sens = 0.0026) {
        const L = this.look;
        if (dx || dy) {
            L.yaw = clamp(L.yaw - dx * sens, -LOOK_YAW, LOOK_YAW);
            L.pitch = clamp(L.pitch - dy * sens, -LOOK_PITCH, LOOK_PITCH);
            L.idle = 0; L.straight = 0;
        } else L.idle += dt;
        const straight = Math.abs(this.steerIn || 0) < 0.05 && Math.abs(this.speed) > 2;
        L.straight = straight && L.idle > 0.3 ? L.straight + dt : 0;
        if (!held || L.straight > 2) { L.yaw = damp(L.yaw, 0, 3.2, dt); L.pitch = damp(L.pitch, 0, 3.2, dt); if (Math.abs(L.yaw) < 1e-3) L.yaw = 0; if (Math.abs(L.pitch) < 1e-3) L.pitch = 0; }
    }
    resetLook() { const L = this.look; L.yaw = L.pitch = L.yawCur = 0; L.idle = L.straight = 0; }
    get fx() { return -Math.sin(this.heading); }
    get fz() { return -Math.cos(this.heading); }

    update(dt, input, opts = {}) {
        dt = Math.min(dt, 0.05);
        const throttle = input.throttle, brake = input.brake;
        const steerIn = input.steer;
        this.steerIn = steerIn;
        // steering: less lock at speed
        // weather grip (1 = dry; rain ≈ 0.7, snow ≈ 0.45): longer braking, softer acceleration, understeer at speed
        const grip = clamp(opts.grip ?? 1, 0.3, 1); this.grip = grip;
        const lock = lerp(0.65, 0.22, clamp(Math.abs(this.speed) / 30, 0, 1)) * lerp(1, 0.55 + 0.45 * grip, clamp(Math.abs(this.speed) / 12, 0, 1));
        this.steer = damp(this.steer, steerIn * lock, 8, dt);
        this.steerVisual = damp(this.steerVisual, steerIn, 6, dt);
        // longitudinal
        const maxSpeed = opts.maxSpeed || this.maxSpeed;
        let acc = 0;
        // after a collision: pressing the opposite direction reverses out immediately (no long brake phase)
        if (this.touching && ((throttle < 0 && this.speed > 0 && this.speed < 3) || (throttle > 0 && this.speed < 0 && this.speed > -3))) this.speed = 0;
        const bk = 0.25 + 0.75 * grip, tr = 0.5 + 0.5 * grip; // braking / traction scale with grip
        if (throttle > 0) acc = this.speed < -0.5 ? 9 * bk : 7.5 * tr * (1 - this.speed / maxSpeed); // (brakes first when rolling backwards)
        else if (throttle < 0) acc = this.speed > 0.5 ? -9 * bk : -3.5 * tr; // brake, then reverse
        if (brake) acc = -Math.sign(this.speed) * Math.min(10 * bk, Math.abs(this.speed) / dt);
        // drag + rolling
        acc -= this.speed * 0.12 + Math.sign(this.speed) * 0.6;
        this.speed += acc * dt;
        if (throttle === 0 && !brake && Math.abs(this.speed) < 0.4) this.speed = 0;
        this.speed = clamp(this.speed, -8, maxSpeed);
        // yaw: kinematic bicycle model, yaw rate = v·tan(δ)/L with SIGNED v -> reversing with the wheel turned
        // right swings the rear to the right (the nose goes left), exactly like a real car.
        const yawRate = this.speed * Math.tan(this.steer) / WHEELBASE;
        this.heading -= yawRate * dt;
        // move (the height surface decides whether the new position is reachable: deck edges / trench walls)
        const ox = this.x, oz = this.z;
        this.x += this.fx * this.speed * dt; this.z += this.fz * this.speed * dt;
        this.followSurface(ox, oz);
        this.collide(dt);
        this.collidePeds(dt);
        // wedged (a corner of two walls, a car and a wall): the pushes cancel the move but neither impact killed
        // the speed -> the speedo would read 6 km/h at a standstill. Keep only what was actually travelled.
        if (this.contactAge === 0 && dt > 0 && Math.abs(this.speed) > 0.3) {
            const real = ((this.x - ox) * this.fx + (this.z - oz) * this.fz) / dt;
            if (Math.sign(real) !== Math.sign(this.speed)) this.speed = 0;
            else if (Math.abs(real) < Math.abs(this.speed) * 0.5) this.speed = real;
        }
        // bounds (soft wall)
        if (this.bounds) {
            const b = this.bounds, m = 40;
            if (this.x < b.minX + m || this.x > b.maxX - m || this.z < b.minZ + m || this.z > b.maxZ - m) {
                this.x = clamp(this.x, b.minX + m, b.maxX - m); this.z = clamp(this.z, b.minZ + m, b.maxZ - m); this.speed *= 0.5;
                this.noteCollider({ type: 'bounds', id: 'map-edge', x: this.x, z: this.z });
            }
        }
        this.collisionCd = Math.max(0, this.collisionCd - dt);
        this.shake = Math.max(0, this.shake - dt * 2);
        this.bob += dt * (2 + Math.abs(this.speed) * 0.3);
        this.updateRig(dt);
    }

    // ------------------------------------------------------------------ road surface (bridges / ramps / tunnels)
    /** detect once per world whether world.roadHeight takes an options object ({ y, edge }) */
    roadHeightMode() {
        const w = this.world; if (!w || typeof w.roadHeight !== 'function') return 'none';
        if (this._rhWorld === w) return this._rhMode;
        this._rhWorld = w; this._rhMode = 'own';
        try { const h = w.roadHeight(this.x, this.z, { y: 0.24 }); if (Number.isFinite(h)) this._rhMode = 'opts'; } catch { /* old positional API */ }
        if (this._rhMode === 'own' && typeof w.edgesInBox !== 'function') this._rhMode = 'legacy';
        return this._rhMode;
    }
    /**
     * Road surface under (x, z) for a car whose current surface is at height yRef. Candidates: every road ribbon
     * (all layers) covering the point, plus the ground unless the point is inside an open trench / portal ramp.
     * Only candidates reachable from yRef (|Δh| ≤ MAX_STEP) count, and among those the ribbon whose centreline is
     * closest wins (the edge we are on and its neighbours get a bonus) — so a car follows the ramp it is driving on
     * even where its ribbon still overlaps the road it branched from, never "jumps" onto a deck above, and never
     * drops through a deck. Where no ribbon matches, the world's own surfaces (sidewalks, junction pads) are used.
     * Nothing reachable → the nearest-height candidate (followSurface then treats the move as blocked).
     * yRef = null → the candidate whose centreline is closest (initial placement).  → { h, edge }
     */
    surfaceAt(x, z, yRef) {
        const w = this.world, out = this._surf || (this._surf = { h: GROUND_Y, edge: null });
        out.h = GROUND_Y; out.edge = null;
        const mode = this.roadHeightMode();
        if (mode === 'none') return out;
        if (mode === 'legacy') { out.h = w.roadHeight(x, z); return out; }
        const own = this.ownSurface(x, z, yRef);
        out.h = own.h; out.edge = own.edge;
        // (SeaTac, Airport Expressway merge at (-985, -20), 2026-11-13: the wheels sank up to 13 cm into the junction) a source
        // bridge junction is drawn as its own slab whose skin stands a little above the edges' linear heights: on it the
        // car rides on the drawn top
        if (own.ok && typeof w.junctionSlabTopAt === 'function') { const t = w.junctionSlabTopAt(x, z); if (t !== null && t > out.h && t - out.h <= SLAB_STEP) out.h = t; }
        if (yRef == null || own.ok) return out;
        // sidewalks / junction pads on decks: the world knows every drivable surface at (x, z)
        if (typeof w.surfacesAt === 'function') {
            let best = null, bd = MAX_STEP;
            for (const h of w.surfacesAt(x, z)) { const d = Math.abs(h - yRef); if (d <= bd) { bd = d; best = h; } }
            if (best !== null) { out.h = best; out.edge = this.supportEdge; }
        } else if (mode === 'opts') {
            const h = w.roadHeight(x, z, { y: yRef, edge: this.supportEdge || undefined });
            if (Number.isFinite(h) && Math.abs(h - yRef) <= MAX_STEP) { out.h = h; out.edge = this.supportEdge; }
        }
        return out;
    }
    ownSurface(x, z, yRef) {
        const res = this._own || (this._own = { h: GROUND_Y, edge: null, ok: false });
        let ground = true, best = null, bs = Infinity, bh = GROUND_Y, near = null, nd = Infinity, nh = GROUND_Y, close = null, cd = Infinity, ch = GROUND_Y;
        const se = this.supportEdge, R = 24;
        // continuity: stay on the edge we are on while inside its ribbon (overlapping ribbons of another road at a
        // slightly different height — a ramp beside the street — are only taken once we leave ours)
        const linked = (e) => se && (e === se || e.a === se.a || e.a === se.b || e.b === se.a || e.b === se.b);
        this.world.edgesInBox(x - R, z - R, x + R, z + R, (e) => {
            if (e.ya === undefined || e.virtual) return;
            const ax = e.a.x, az = e.a.z, dx = e.b.x - ax, dz = e.b.z - az, L2 = dx * dx + dz * dz || 1;
            const tr = ((x - ax) * dx + (z - az) * dz) / L2, t = clamp(tr, 0, 1);
            const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
            const hw = roadWidthAt(e, x, z) + 0.6;
            // past the ends: the junction pad (node radius) counts as part of the ribbon
            const lim = tr < 0 ? Math.max(hw, (e.a.radius ?? 0) + 0.8) : tr > 1 ? Math.max(hw, (e.b.radius ?? 0) + 0.8) : hw;
            if (d > lim) return;
            const h = GROUND_Y + (e.sourceBridgeGrade?.known ? e.sourceBridgeGrade.heightAtWorld(x, z) : e.ya + (e.yb - e.ya) * t);
            if (h < GROUND_Y - 0.3 && !e.tunnel) ground = false; // open trench / portal ramp: no ground surface here (a covered tunnel keeps the ground above it)
            if (yRef != null) {
                const dh = Math.abs(h - yRef);
                // (beyond the segment ends = on the junction pad: the edge that actually spans the point is preferred,
                //  otherwise a steep ramp starting at a node would be "covered" by the previous edge's flat cap)
                const past = tr < 0 ? -tr : tr > 1 ? tr - 1 : 0;
                if (dh <= MAX_STEP) { const sc = d / hw - (e === se ? 0.9 : linked(e) ? 0.35 : 0) + dh * 0.2 + (past > 0 ? 0.8 + past * Math.sqrt(L2) / hw : 0); if (sc < bs) { bs = sc; best = e; bh = h; } }
                if (dh < cd) { cd = dh; close = e; ch = h; }
            }
            // initial placement: nearest centreline, strongly preferring roads aligned with the car's heading
            const sc = d + (this._placeHeading !== undefined ? 12 * (1 - Math.abs(e.dirx * -Math.sin(this._placeHeading) + e.dirz * -Math.cos(this._placeHeading))) : 0)
                + (Math.abs(h - GROUND_Y) > 0.5 ? 4 : 0); // ambiguous (a ramp beside / above the street): street level
            if (sc < nd) { nd = sc; near = e; nh = h; }
        });
        res.ok = true;
        if (yRef == null) { res.edge = near; res.h = near ? nh : GROUND_Y; return res; }
        if (best) { res.h = bh; res.edge = best; return res; }
        if (ground && Math.abs(GROUND_Y - yRef) <= MAX_STEP) { res.h = GROUND_Y; res.edge = null; return res; }
        res.ok = false;
        if (ground && (!close || Math.abs(GROUND_Y - yRef) < cd)) { res.h = GROUND_Y; res.edge = null; return res; }
        res.h = close ? ch : GROUND_Y; res.edge = close; return res;
    }
    /** after moving from (ox, oz): pick the surface; a sudden drop / rise is a deck edge or trench wall → slide / stop */
    followSurface(ox, oz) {
        if (this.surfY === undefined) { const s0 = this.surfaceAt(ox, oz, null); this.surfY = s0.h; this.supportEdge = s0.edge; }
        const s = this.surfaceAt(this.x, this.z, this.surfY);
        if (Math.abs(s.h - this.surfY) <= MAX_STEP) { this.surfY = s.h; this.supportEdge = s.edge; return; }
        // not reachable: slide along the supporting edge if possible, else stay
        const e = this.supportEdge;
        const mx = this.x - ox, mz = this.z - oz;
        let nx = 0, nz = 0, ok = false;
        if (e) {
            const along = mx * e.dirx + mz * e.dirz;
            const sx = ox + e.dirx * along, sz = oz + e.dirz * along;
            const s2 = this.surfaceAt(sx, sz, this.surfY);
            if (Math.abs(s2.h - this.surfY) <= MAX_STEP) { this.x = sx; this.z = sz; this.surfY = s2.h; this.supportEdge = s2.edge; ok = true; }
            // wall normal: the edge normal pointing back toward the centreline
            const side = (ox - e.a.x) * e.nx + (oz - e.a.z) * e.nz;
            nx = -Math.sign(side || 1) * e.nx; nz = -Math.sign(side || 1) * e.nz;
        }
        if (!ok) {
            this.x = ox; this.z = oz;
            const ml = Math.hypot(mx, mz) || 1; if (!e) { nx = -mx / ml; nz = -mz / ml; }
        }
        this.deckContact = true;
        this.impact(nx, nz, 0, 'edge', null, 0.7);
        this.noteCollider({ type: s.h < this.surfY ? 'deck-edge' : 'ramp-wall', id: e ? `edge:${e.id}` : 'ground', x: this.x, z: this.z, y: this.surfY, to: +s.h.toFixed(2), name: e?.name || '' });
    }

    /** collision candidates must be real geometry at the car's level (no collisions with things under a bridge) */
    atLevel(b) {
        if (b.wall && b.y0a !== undefined) return true; // world walls carry their own height band (checked by collideBuildings)
        if (b.yMax !== undefined && (this.surfY ?? GROUND_Y) > b.yMax) return false; // piers: only below the deck
        const base = b.y ?? b.base ?? 0, top = b.top ?? (base + (b.h ?? 1e4));
        const bottom = (this.surfY ?? GROUND_Y) - GROUND_Y; // underside of the car relative to the road surface top
        return bottom + 0.35 < top && bottom + 1.5 > base;
    }
    /** describe a world collider for the debug log */
    describe(b) {
        const type = b.wall ? 'wall' + (b.kind ? ':' + b.kind : '') : b.prop ? (b.kind || (b.hw === b.r ? 'prop-circle' : 'prop-box')) : b.poly ? (b.kind || 'building') : (b.kind || 'landmark-box');
        return { type, kind: b.kind ?? (b.wall ? 'wall' : b.prop ? 'prop' : b.poly ? 'building' : 'box'), id: b.id ?? b.osmId ?? b.name ?? (b.edge ? 'edge:' + b.edge.id : null), x: +(+b.x).toFixed(1), z: +(+b.z).toFixed(1), r: b.r != null ? +(+b.r).toFixed(2) : null, h: b.h ?? null, poly: b.poly ? b.poly.length : 0 };
    }
    noteCollider(info) {
        const d = this.debug;
        info.t = +(performance.now() / 1000).toFixed(2);
        info.px = +this.x.toFixed(1); info.pz = +this.z.toFixed(1); info.py = +(this.surfY ?? GROUND_Y).toFixed(2); info.speed = +this.speed.toFixed(2);
        d.lastCollider = info; d.hits.push(info); if (d.hits.length > 40) d.hits.shift();
        d.count++;
    }

    /** within 25 m of a district-edge closure (main sets `softZones` = world.closures): its cones, boards and
     *  barriers stop the car softly, without damage or fines (spec R10.9) */
    nearClosure() { const zs = this.softZones; if (!zs || !zs.length) return false; for (const z of zs) if (Math.abs(z.x - this.x) < 25 && Math.abs(z.z - this.z) < 25 && this.atLevel(z)) return true; return false; }
    collide(dt) {
        // Penetration is resolved fully (minimum translation), speed is damped by the impact angle instead of
        // being killed, and moving away from an obstacle is never damped -> you can always reverse / steer out.
        let contact = false;
        const w = this.world;
        if (w && w.buildings) {
            const one = this._one || (this._one = [null]);let bodySampler;
            for (let pass = 0; pass < 2; pass++) {
                let any = false;
                // three 1 m circles along the axis + (2026-11-08, owner: "collision happens after part of my car went inside")
                // four 0.4 m circles at the body's corners: the corners stuck 0.2–0.3 m out of the axis circles
                // (circles along the axis from the boot to the nose, radius = half the width; 0.35 m circles in the corners,
                //  the nose corners pulled in for the bonnet's taper)
                const lx = -this.fz, lz = this.fx;
                const SAMPLES = this._colS || (this._colS = (() => { const F = this.front, B = this.rear, R = this.width / 2, out = [], n = Math.max(3, Math.ceil((F + B - 2 * R) / (R * 1.4)) + 1);
                    for (let k = 0; k < n; k++) out.push([F - R - (F + B - 2 * R) * k / (n - 1), 0, R]);
                    out.push([F - 0.35, R * 0.85 - 0.35, 0.35], [F - 0.35, -(R * 0.85 - 0.35), 0.35], [-B + 0.35, R - 0.35, 0.35], [-B + 0.35, -(R - 0.35), 0.35]);
                    return out; })());
                for (const [o, l, rad] of SAMPLES) {
                    const px = this.x + this.fx * o + lx * l, pz = this.z + this.fz * o + lz * l;
                    let sx = 0, sz = 0, hit = null;
                    const test = (b) => {
                        // A pitched cockpit has a different vertical band at
                        // each forward/rear probe. Keep the actual slab query;
                        // do not replace it with the road under the probe.
                        const dx = px - b.x, dz = pz - b.z, rr = (b.r ?? 0) + rad;
                        if (dx * dx + dz * dz > rr * rr) return;
                        const band = b.roadDeck && this.supportEdge?.sourceBridgeGrade?.known ? (bodySampler ||= playerBodySampler(this))(px, pz, rad) : null;
                        if (band?.known) {
                            if ((b.y0 !== undefined && band.max < b.y0) || (b.y1 !== undefined && band.min > b.y1)) return;
                        } else if (!this.atLevel(b)) return;
                        one[0] = b; const r = collideBuildings(one, px, pz, rad, band?.known ? band.min : this.surfY ?? GROUND_Y, band?.known ? band.max - band.min : 2);
                        if (r) { sx += r.px; sz += r.pz; hit = b; }
                    };
                    if (w.buildings.query) w.buildings.query(px, pz, 3, test); else for (const b of w.buildings) test(b);
                    // wall segments (bridge parapets, retaining walls) if the world provides them
                    const wr = this.wallsInBuildings() ? null : this.collideWalls(px, pz, rad);
                    if (wr) { sx += wr.px; sz += wr.pz; hit = wr.wall; }
                    if (!hit) continue;
                    const pl = Math.hypot(sx, sz); if (pl < 1e-5) continue;
                    this.x += sx * 1.01; this.z += sz * 1.01; bodySampler = null; any = contact = true;
                    const vn = this.speed * ((this.fx * sx + this.fz * sz) / pl);
                    if (vn < -0.05 || !this.debug.lastCollider || this.debug.lastCollider.ref !== hit) {
                        const info = hit.__wall ? { type: 'wall', id: hit.id ?? null, x: +hit.ax.toFixed(1), z: +hit.az.toFixed(1), x2: +hit.bx.toFixed(1), z2: +hit.bz.toFixed(1) } : this.describe(hit);
                        this.noteCollider(info); Object.defineProperty(info, 'ref', { value: hit, enumerable: false });
                    }
                    if (hit.soft || hit.kind === 'closure' || this.nearClosure()) { this.closureHit = hit; this.closureAt = performance.now(); this.impact(sx / pl, sz / pl, 0, 'closure', null, 0.95); } // district-edge closure: soft stop, no damage
                    else this.impact(sx / pl, sz / pl, 0, 'building', null, 0.75);
                }
                if (!any) break;
            }
        }
        if (this.traffic) {
            const near = this.traffic.near(this.x, this.z, 18);
            for (let pass = 0; pass < 3; pass++) {
                let any = false;
                for (const v of near) {
                    if (Math.abs((v.y ?? GROUND_Y) - (this.surfY ?? GROUND_Y)) > 2) continue; // other level (bridge / tunnel)
                    const m = this.satVehicle(v); if (!m) continue;
                    this.x += m.nx * (m.pen + 0.01); this.z += m.nz * (m.pen + 0.01); any = contact = true;
                    // NPC velocity along the contact normal
                    const vvn = (v.fx * m.nx + v.fz * m.nz) * v.speed;
                    if (this.debug.lastCollider?.id !== 'veh:' + v.id || this.debug.lastCollider.type !== 'vehicle') this.noteCollider({ type: 'vehicle', id: 'veh:' + v.id, kind: v.kind, x: +v.x.toFixed(1), z: +v.z.toFixed(1), parked: !!v.parked });
                    this.impact(m.nx, m.nz, vvn, 'vehicle', v, 0.55);
                }
                if (!any) break;
            }
        }
        if (this.deckContact) { contact = true; this.deckContact = false; }
        this.contactAge = contact ? 0 : (this.contactAge ?? 9) + dt;
    }
    /** the world's walls already live in world.buildings (collideBuildings handles their height band) */
    wallsInBuildings() { const ws = this.world?.walls; return !!(ws && ws.length && ws[0] && ws[0].wall && ws[0].y0a !== undefined); }
    /** normalised wall segments from world.walls (any of a few plausible shapes), cached per array */
    wallList() {
        const src = this.world && this.world.walls;
        if (!src) return null;
        if (this._wallSrc === src && this._wallLen === (src.length ?? 0)) return this._walls;
        const list = [];
        const arr = Array.isArray(src) ? src : (src.list || src.segments || src.items || []);
        for (const w of arr) {
            let ax, az, bx, bz;
            if (Array.isArray(w)) { [[ax, az], [bx, bz]] = w; }
            else if (w.a && w.b) { ax = w.a.x ?? w.a[0]; az = w.a.z ?? w.a[1]; bx = w.b.x ?? w.b[0]; bz = w.b.z ?? w.b[1]; }
            else if (w.x1 !== undefined) { ax = w.x1; az = w.z1; bx = w.x2; bz = w.z2; }
            else if (w.ax !== undefined) { ax = w.ax; az = w.az; bx = w.bx; bz = w.bz; }
            else continue;
            if (![ax, az, bx, bz].every(Number.isFinite)) continue;
            const base = w.y0a !== undefined ? Math.min(w.y0a, w.y0b ?? w.y0a) : w.y0 ?? w.y ?? w.base ?? w.bottom ?? (w.ya !== undefined ? Math.min(w.ya, w.yb ?? w.ya) : 0);
            const top = w.y1a !== undefined ? Math.max(w.y1a, w.y1b ?? w.y1a) : w.y1 ?? w.top ?? (w.h !== undefined ? base + w.h : (w.height !== undefined ? base + w.height : base + 1e4));
            list.push({ __wall: true, wall: true, id: w.id ?? list.length, ax, az, bx, bz, y: base, top, t: (w.t ?? w.thickness ?? 0.3) / 2, x: (ax + bx) / 2, z: (az + bz) / 2, r: Math.hypot(bx - ax, bz - az) / 2 + 1 });
        }
        // grid for fast lookup
        const cell = 40, grid = new Map();
        for (const s of list) {
            const x0 = Math.floor(Math.min(s.ax, s.bx) / cell), x1 = Math.floor(Math.max(s.ax, s.bx) / cell), z0 = Math.floor(Math.min(s.az, s.bz) / cell), z1 = Math.floor(Math.max(s.az, s.bz) / cell);
            for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 100003 + j; let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(s); }
        }
        list.grid = grid; list.cell = cell;
        this._wallSrc = src; this._wallLen = src.length ?? 0; this._walls = list;
        return list;
    }
    collideWalls(x, z, radius) {
        const list = this.wallList(); if (!list || !list.length) return null;
        const k = list.cell, cand = list.grid.get(Math.floor(x / k) * 100003 + Math.floor(z / k)); if (!cand) return null;
        let px = 0, pz = 0, hit = null;
        for (const s of cand) {
            if (!this.atLevel(s)) continue;
            const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
            const t = clamp(((x - s.ax) * dx + (z - s.az) * dz) / L2, 0, 1);
            const cx = s.ax + dx * t, cz = s.az + dz * t, ex = x - cx, ez = z - cz, d = Math.hypot(ex, ez);
            const lim = radius + s.t; if (d >= lim) continue;
            const nx = d > 1e-4 ? ex / d : -dz / Math.sqrt(L2), nz = d > 1e-4 ? ez / d : dx / Math.sqrt(L2);
            px += nx * (lim - d); pz += nz * (lim - d); hit = s;
        }
        return hit ? { px, pz, wall: hit } : null;
    }
    /** true while the car is (or was a moment ago) touching something */
    get touching() { return (this.contactAge ?? 9) < 0.35; }
    /** SAT between the player rectangle and vehicle v → {nx, nz, pen} (normal points from v to the player) or null */
    satVehicle(v) {
        const co = (this.front - this.rear) / 2; // (the body's centre sits ahead of the eye)
        const dx = this.x + this.fx * co - v.x, dz = this.z + this.fz * co - v.z;
        const lim = (this.length + v.length) * 0.5 + 1; if (Math.abs(dx) > lim || Math.abs(dz) > lim) return null;
        const fx = this.fx, fz = this.fz, rx = -fz, rz = fx;
        // the NPC box as drawn (mesh heading; it lags the lane direction through turns)
        const vfx = Number.isFinite(v.heading) ? -Math.sin(v.heading) : v.fx, vfz = Number.isFinite(v.heading) ? -Math.cos(v.heading) : v.fz, vrx = -vfz, vrz = vfx;
        const pl = this.length / 2, pw = this.width / 2, vl = v.length / 2, vw = v.width / 2;
        let best = Infinity, bx = 0, bz = 0;
        for (const [ux, uz] of [[fx, fz], [rx, rz], [vfx, vfz], [vrx, vrz]]) {
            const ra = Math.abs(fx * ux + fz * uz) * pl + Math.abs(rx * ux + rz * uz) * pw;
            const rb = Math.abs(vfx * ux + vfz * uz) * vl + Math.abs(vrx * ux + vrz * uz) * vw;
            const d = dx * ux + dz * uz; const pen = ra + rb - Math.abs(d);
            if (pen <= 0) return null;
            if (pen < best) { best = pen; const sg = d >= 0 ? 1 : -1; bx = ux * sg; bz = uz * sg; }
        }
        return { nx: bx, nz: bz, pen: best };
    }
    /** contact response along normal (nx,nz) (pointing toward the player); otherVn = obstacle velocity along n */
    impact(nx, nz, otherVn, what, v, damp) {
        const cos = this.fx * nx + this.fz * nz;           // >0: normal along our forward
        const vn = this.speed * cos - otherVn;            // relative normal velocity (<0 = closing)
        if (vn >= -0.05) return;                            // separating: never hold the car back
        const strength = -vn;
        if (this.collisionCd <= 0 && strength > 1.5 && what !== 'closure') this.hit(strength, what, v);
        // remove (most of) the closing normal component; tangential sliding is kept
        const k = Math.abs(cos);
        if (k > 0.85 && strength > 5 && what === 'building') this.speed = -this.speed * 0.15; // small bounce off walls
        else if (what === 'closure') this.speed *= 1 - damp; // (soft: a stop, not a crash)
        else this.speed *= 1 - damp * k;
        if (Math.abs(this.speed) < 0.05) this.speed = 0;
    }
    /** pedestrians: knocked over when the car body actually hits them above walking pace, nudged aside otherwise
     *  (round 6 note 11: only "on the road" pedestrians could fall, and a 3 s cooldown let the car pass through the rest) */
    collidePeds() {
        if (!this.traffic || !this.traffic.nearPeds) return;
        const pedY = this.world?.deckWalkLevel ? (this.surfY ?? GROUND_Y) : null; // (bridge-walkways.js: walkers on a deck walkway are at its level)
        if (pedY === null && Math.abs((this.surfY ?? GROUND_Y) - GROUND_Y) > 1.5) return; // on a deck / in a tunnel: pedestrians are on another level
        this.pedCd = Math.max(0, (this.pedCd || 0) - 1 / 60);
        // (2026-11-08) the body as drawn (nose `front` m ahead of the eye, boot `rear` m behind) and the person's reach
        // (an umbrella / guitar / flag / bag they carry: crowd.reach)
        const HW = this.width / 2 + 0.05, co = (this.front - this.rear) / 2, HL = (this.front + this.rear) / 2, sp = Math.abs(this.speed), sx = -this.fz, sz = this.fx;
        const C = this.traffic.peds?.crowd;
        for (const p of this.traffic.nearPeds(this.x + this.fx * co, this.z + this.fz * co, 5)) {
            if (p.state === 'down') continue;
            if (pedY !== null && Math.abs(pedY - (p.deckY ?? GROUND_Y)) > 1.5) continue;
            const PR = p.reach || (C?.reach ? C.reach(p.i) : 0.3);
            const dx = p.x - this.x, dz = p.z - this.z;
            const lon = dx * this.fx + dz * this.fz - co, lat = dx * sx + dz * sz;
            const inLon = Math.abs(lon) < HL + PR, inLat = Math.abs(lat) < HW + PR;
            if (inLon && inLat && sp > 2.2) { // the body hit them
                const dir = Math.sign(this.speed) || 1, side = Math.sign(lat) || 1;
                const nx = this.fx * dir * 0.7 + sx * side * 0.5, nz = this.fz * dir * 0.7 + sz * side * 0.5;
                if (this.traffic.peds.knock(p, nx, nz, sp)) {
                    if (this.pedCd <= 0) { this.pedCd = 1.5; this.shake = clamp(sp / 15, 0.2, 0.8); this.onCollide(sp, 'pedestrian', p); }
                    this.speed *= 0.85;
                }
                continue;
            }
            // slow, or just brushing past: step them out of the car's way (to the nearer side)
            if (Math.abs(lon) < HL + PR + 0.2 && Math.abs(lat) < HW + PR + 0.2) {
                // (stepping aside at a walk's pace — a 1.4 m jump in one frame read as a teleport)
                const side = Math.sign(lat) || 1, push = Math.min(HW + PR + 0.2 - Math.abs(lat), (sp + 2.5) / 60);
                p.x += sx * side * push; p.z += sz * side * push;
            }
        }
    }
    /** render the rear view into the mirror texture (call before the main render) */
    renderMirror(renderer, scene) {
        if (!this.driveRigShown || !this.mirrorEnabled || this.lookBack) return;
        const shown = this.mirror.visible;
        this.mirror.visible = false;
        const prev = renderer.getRenderTarget();
        // a cheap view: far 150 m (set in the constructor), layer 0 only (layer 1 = cockpit, layer 2 = main-view-only
        // detail: backdrop / horizon / far LOD), and no shadow-map pass of its own (the main frame's maps are reused)
        const sm = renderer.shadowMap, au = sm.autoUpdate, nu = sm.needsUpdate; sm.autoUpdate = false; sm.needsUpdate = false;
        renderer.setRenderTarget(this.mirrorTarget);
        const lod = this.world?.vegetation?.mirrorLod; lod?.(true); // (r2-perf-5: low-poly near crowns in the mirror only, trees.js)
        try { renderer.render(scene, this.mirrorCam); } finally { lod?.(false); }
        renderer.setRenderTarget(prev);
        sm.autoUpdate = au; sm.needsUpdate = nu;
        this.mirror.visible = shown && this.driveRigShown && this.mirrorEnabled && !this.lookBack;
    }
    hit(strength, what, v) {
        if (this.collisionCd > 0) return;
        this.collisionCd = 0.5;
        this.shake = clamp(strength / 12, 0.15, 1);
        this.onCollide(strength, what, v);
    }

    updateRig(dt) {
        // follow the road surface the car is on (bridges, overpasses, tunnels): sample the surface ahead and
        // behind on the same layer for the pitch
        let y = this.surfY ?? GROUND_Y, pitch = 0;
        if (this.world && this.surfY !== undefined && this.roadHeightMode() !== 'none') {
            const hF = this.surfaceAt(this.x + this.fx * 2.2, this.z + this.fz * 2.2, this.surfY).h;
            const hB = this.surfaceAt(this.x - this.fx * 2.2, this.z - this.fz * 2.2, this.surfY).h;
            const ok = (h) => Math.abs(h - this.surfY) <= MAX_STEP * 1.5;
            pitch = Math.atan2((ok(hF) ? hF : this.surfY) - (ok(hB) ? hB : this.surfY), 4.4);
        }
        if (this.y === undefined || !dt) { this.y = y; this.pitch = pitch; }
        else { this.y = damp(this.y, y, 14, dt); this.pitch = damp(this.pitch || 0, pitch, 10, dt); }
        this.rig.position.set(this.x, this.y, this.z);
        this.rig.rotation.set(this.pitch, this.heading, 0, 'YXZ');
        // body roll / pitch
        const roll = -this.steerVisual * clamp(Math.abs(this.speed) / 25, 0, 1) * 0.035;
        this.rig.rotation.z = roll;
        // steering wheel: the driver looks along -z, so a clockwise turn (steering right) is a negative z rotation
        this.cockpit.userData.wheel.rotation.z = -this.steerVisual * 1.6;
        // camera bob + shake + look-back + mouse look
        const s = this.shake, d = dt || 0.016, L = this.look;
        const bobY = Math.sin(this.bob) * 0.004 * clamp(Math.abs(this.speed) / 10, 0, 1);
        const pv = this.cockpit?.userData.viewFor?.(this.camera.aspect, document.body.classList.contains('touch')) || null; // portrait phones: eye / yaw / FOV per aspect (cockpit-ui, R17.1)
        this.camHolder.position.y = 1.36 + (pv?.eye.y || 0) + bobY + (Math.random() - 0.5) * s * 0.08;
        if (this.mirror) this.mirror.visible = this.driveRigShown && this.mirrorEnabled && !this.lookBack;
        L.baseYaw = damp(L.baseYaw, (this.lookBack ? Math.PI : 0) + this.steerVisual * 0.06, 10, d);
        L.yawCur = damp(L.yawCur, this.lookBack ? 0 : L.yaw, 22, d);
        // looking far to the side / back: the head leans toward the centre of the car a little
        const lean = clamp(Math.abs(L.yawCur) / LOOK_YAW, 0, 1);
        this.camHolder.position.x = -0.3 + (pv?.eye.x || 0) + (L.yawCur < 0 ? 0.16 : 0.06) * lean;
        this.camHolder.position.z = -0.45 + (pv?.eye.z || 0) + 0.08 * lean;
        this.camHolder.rotation.y = L.baseYaw + L.yawCur + (this.lookBack ? 0 : (pv?.yaw || 0));
        this.camHolder.rotation.x = (Math.random() - 0.5) * s * 0.04 + this.speed * 0.0004 + (this.lookBack ? 0 : L.pitch);
        this.camHolder.rotation.z = (Math.random() - 0.5) * s * 0.03;
        this.camera.fov = damp(this.camera.fov, (pv?.fov ?? 72) + clamp(this.speed, 0, 40) * 0.35, 4, d);
        this.camera.updateProjectionMatrix();
    }
}
