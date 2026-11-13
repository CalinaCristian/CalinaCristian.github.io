// ============================================================================
//  ON FOOT (spec 14) — a reusable first-person walker: mouse look, WASD, Shift
//  run, Space jump, head bob; collides with buildings / props / walls (incl.
//  the district-edge closure fences), vehicles (they bump you) and any extra
//  boxes the host passes (the parked player car). Used by the street game
//  (get out of the car) and by the tourist-spot scenes (spec 15).
//
//  new OnFootController({ scene, camera, input, colliders, world?, traffic?, audio?, obstacles?, groundAt? })
//    colliders: a collision list for collideBuildings (world.buildings, with .query) — or null
//    obstacles(): [{ x, z, y?, fx, fz, length, width }] extra oriented boxes (e.g. the parked car; y = base height, default the walker's ground)
//    groundAt(x, z, y): ground height under the walker (default: world.roadHeight / 0)
//  enter(x, z, heading, y) · exit() · update(dt) · get position() · teleport(x, z, heading?)
// ============================================================================
import * as THREE from '../vendor/three.module.min.js';
import { collideBuildings } from './world-collide.js';
import { clamp, damp } from './util.js';

const EYE = 1.65, R = 0.3, WALK = 1.7, RUN = 4.6, JUMP_V = 4.4, G = 9.8, STEP = 0.7; // (after round 6: hills / kerbs / canal copings no longer stop you dead; a jump clears ≈ 1 m)

export class OnFootController {
    constructor({ scene, camera, input, colliders = null, world = null, traffic = null, audio = null, obstacles = null, groundAt = null } = {}) {
        this.scene = scene; this.camera = camera; this.input = input; this.colliders = colliders; this.world = world;
        this.traffic = traffic; this.audio = audio; this.obstacles = obstacles; this.groundAtFn = groundAt;
        this.rig = new THREE.Object3D(); this.rig.rotation.order = 'YXZ'; this.rig.name = 'onfoot';
        this.x = 0; this.z = 0; this.y = 0; this.heading = 0; this.pitch = 0;
        this.vx = 0; this.vz = 0; this.vy = 0; this.jumpY = 0; this.vel = 0; this.t = 0; this.stepT = 0;
        this.active = false; this.bumped = 0;
    }
    get position() { return { x: this.x, z: this.z, y: this.y + this.jumpY, heading: this.heading }; }
    /** forward unit vector (−z at heading 0, like the car) */
    get fx() { return -Math.sin(this.heading); }
    get fz() { return -Math.cos(this.heading); }
    get speed() { return this.vel; }
    enter(x, z, heading = 0, y = null) {
        this.x = x; this.z = z; this.heading = heading; this.pitch = 0; this.vx = this.vz = this.vy = 0; this.jumpY = 0;
        this.y = y ?? this.groundAt(x, z, 0);
        if (!this.rig.parent) this.scene.add(this.rig);
        this.rig.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0);
        this.active = true; this.place();
    }
    exit() { this.active = false; if (this.camera.parent === this.rig) this.rig.remove(this.camera); if (this.rig.parent) this.rig.parent.remove(this.rig); }
    teleport(x, z, heading = this.heading) { this.x = x; this.z = z; this.heading = heading; this.vx = this.vz = 0; this.y = this.groundAt(x, z, this.y); this.place(); }
    groundAt(x, z, y) {
        if (this.groundAtFn) return this.groundAtFn(x, z, y);
        const w = this.world;
        if (w?.roadHeight) { try { const h = w.roadHeight(x, z, { y }); if (Number.isFinite(h)) return Math.max(0, h); } catch { /* ignore */ } }
        return 0;
    }
    update(dt) {
        if (!this.active) return;
        dt = Math.min(dt, 0.05); this.t += dt;
        const inp = this.input;
        const lk = inp.takeLook();
        this.heading -= lk.dx * 0.0024; this.pitch = clamp(this.pitch - lk.dy * 0.0024, -1.3, 1.3);
        const mouse = inp.lookHeld || inp.locked;
        let fwd = 0, side = 0, turn = 0;
        if (inp.keys.has('KeyW') || inp.keys.has('ArrowUp')) fwd += 1;
        if (inp.keys.has('KeyS') || inp.keys.has('ArrowDown')) fwd -= 1;
        if (!inp.keys.size && inp.touch?.throttle) fwd = inp.touch.throttle;
        const a = inp.keys.has('KeyA'), d = inp.keys.has('KeyD');
        if (mouse) side = (d ? 1 : 0) - (a ? 1 : 0); else turn += (d ? 1 : 0) - (a ? 1 : 0);
        turn += (inp.keys.has('ArrowRight') ? 1 : 0) - (inp.keys.has('ArrowLeft') ? 1 : 0);
        if (!inp.keys.size && inp.touch?.steer) turn = inp.touch.steer;
        if (this.auto) { fwd = this.auto.fwd ?? 0; side = this.auto.side ?? 0; turn = 0; if (this.auto.heading != null) this.heading = this.auto.heading; } // (harness walker)
        this.heading -= turn * 1.9 * dt;
        if (!mouse && !turn && Math.abs(fwd) > 0) this.pitch = damp(this.pitch, 0, 2, dt);
        const sp = (inp.shift || this.auto?.run) ? RUN : WALK;
        const fx = this.fx, fz = this.fz, rx = -fz, rz = fx;
        let wx = fx * fwd + rx * side, wz = fz * fwd + rz * side; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
        const k = 1 - Math.exp(-(this.jumpY > 0 ? 2 : 10) * dt);
        this.vx += (wx * sp - this.vx) * k; this.vz += (wz * sp - this.vz) * k;
        const ox = this.x, oz = this.z;
        this.x += this.vx * dt; this.z += this.vz * dt;
        // ground: walk up kerbs / ramps (≤ STEP per move), a higher ledge or a deck edge is a wall
        const blocked = (h) => h - this.y > STEP && this.jumpY + this.y < h - 0.15;
        let gy = this.groundAt(this.x, this.z, this.y + this.jumpY);
        if (blocked(gy)) { // slide along the ledge: keep the part of the move that is free (x only, then z only)
            const tx = this.x, tz = this.z; let ok = false;
            for (const [px, pz] of [[tx, oz], [ox, tz]]) { const h = this.groundAt(px, pz, this.y + this.jumpY); if (!blocked(h)) { this.x = px; this.z = pz; gy = h; ok = true; break; } }
            if (!ok) { this.x = ox; this.z = oz; gy = this.y; }
        }
        // (owner, 2026-11-11, L29, Carturesti Carusel: "jumping from the top floor teleports to the ground, no falling") stepping off
        // a gallery, a deck edge or a wall is a fall: a drop of more than 0.35 m becomes height above the new ground (gravity below)
        if (this.jumpY <= 0) { if (this.y - gy > .35) { this.jumpY = this.y - gy; this.vy = Math.min(this.vy, 0); } this.y = gy; }
        else if (gy > this.y) { this.jumpY = Math.max(0, this.jumpY - (gy - this.y)); this.y = gy; }
        else if (gy < this.y) { this.jumpY += this.y - gy; this.y = gy; } // (airborne over lower ground: keep the absolute height)
        this.collide();
        this.vel = Math.hypot(this.x - ox, this.z - oz) / Math.max(dt, 1e-4);
        if ((inp.take('Space') || this.auto?.jump) && this.jumpY <= 0) { this.vy = JUMP_V; this.audio?.blip?.(330, 0.04, 0.04); if (this.auto) this.auto.jump = false; }
        if (this.vy !== 0 || this.jumpY > 0) { this.vy -= G * dt; this.jumpY += this.vy * dt; if (this.jumpY <= 0) { this.jumpY = 0; this.vy = 0; } }
        // footsteps
        if (this.jumpY <= 0 && this.vel > 0.5) { this.stepT += dt * this.vel; if (this.stepT > (this.vel > 3 ? 1.6 : 1.3)) { this.stepT = 0; this.audio?.blip?.(this.vel > 3 ? 170 : 140, 0.025, 0.015); } }
        this.place();
    }
    place() {
        const bob = this.jumpY > 0 ? 0 : Math.sin(this.t * 7.5 * (this.vel > 3 ? 1.35 : 1)) * 0.025 * Math.min(1.6, this.vel / 2);
        this.rig.position.set(this.x, this.y + EYE + this.jumpY + bob, this.z);
        this.rig.rotation.set(this.pitch, this.heading, 0, 'YXZ');
    }
    collide() {
        const feet = this.y + this.jumpY;
        for (let pass = 0; pass < 2; pass++) {
            let any = false;
            // buildings, props, walls (the world's walls carry a height band; closures are fences on foot too)
            const C = this.colliders;
            if (C) {
                const test = (b) => {
                    if (b.y0a === undefined && b.prop && (b.h ?? 3) + (b.y ?? 0) < feet + 0.3) return; // jumped onto / over a low prop
                    const one = this._one || (this._one = [null]); one[0] = b;
                    const r = collideBuildings(one, this.x, this.z, R, feet + 0.2);
                    if (r) { this.x += r.px * 1.01; this.z += r.pz * 1.01; any = true; }
                };
                if (C.query) C.query(this.x, this.z, 3, test); else for (const b of C) test(b);
            }
            // vehicles: oriented boxes, they push you aside (and you can't walk through them)
            const boxes = [];
            if (this.traffic?.near) for (const v of this.traffic.near(this.x, this.z, 9)) if (Math.abs((v.y ?? 0.24) - 0.24 - this.y) < 2) boxes.push({ x: v.x, z: v.z, y: (v.y ?? 0.24) - 0.24, fx: -Math.sin(v.heading), fz: -Math.cos(v.heading), length: v.length, width: v.width, speed: v.speed, v });
            if (this.obstacles) for (const o of this.obstacles() || []) boxes.push(o);
            for (const o of boxes) {
                const dx = this.x - o.x, dz = this.z - o.z;
                const f = dx * o.fx + dz * o.fz, l = dx * -o.fz + dz * o.fx;
                const hl = o.length / 2 + R, hw = o.width / 2 + R;
                if (Math.abs(f) >= hl || Math.abs(l) >= hw) continue;
                if (feet - (o.y ?? this.y) > 1.3) continue; // above its base (on the roof after a jump): fine — relative, so it works on any terrain height (spots)
                const pf = hl - Math.abs(f), pl = hw - Math.abs(l);
                if (pl < pf) { const s = l >= 0 ? 1 : -1; this.x += -o.fz * s * pl; this.z += o.fx * s * pl; } else { const s = f >= 0 ? 1 : -1; this.x += o.fx * s * pf; this.z += o.fz * s * pf; }
                if ((o.speed || 0) > 1.5) this.bumped = this.t; // a moving car shoved you
                any = true;
            }
            // people (2026-11-08, owner: "account for the objects in their hands"): their body + what they carry (an open
            // umbrella's canopy, a guitar, a bag: crowd.reach) keeps you apart; you share the push with them (someone
            // talking to you / an officer holds their ground)
            const peds = this.traffic?.peds;
            if (peds?.near && !this.airborne) for (const p of peds.near(this.x, this.z, 1.6)) {
                if (p.state === 'down' || p.hidden) continue;
                const rr = R + (p.reach || (peds.crowd?.reach ? peds.crowd.reach(p.i) : 0.3)) - 0.05;
                let dx = this.x - p.x, dz = this.z - p.z; const d = Math.hypot(dx, dz); if (d >= rr) continue;
                if (d < 1e-3) { dx = -this.fx || 1; dz = -this.fz || 0; } else { dx /= d; dz /= d; }
                const ov = rr - Math.max(d, 0), hold = p.talkT > 0 || p.agent || p.react, kp = hold ? 0 : 0.4;
                this.x += dx * ov * (1 - kp); this.z += dz * ov * (1 - kp);
                if (kp) { p.x -= dx * ov * kp; p.z -= dz * ov * kp; }
                any = true;
            }
            if (!any) break;
        }
    }
}
