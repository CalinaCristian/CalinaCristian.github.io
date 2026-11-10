// ============================================================================
//  Collisions + a minimal first-person walker for spot scenes.
//  The session prefers the game's OnFootController (src/onfoot.js, spec 14) and
//  falls back to LocalWalker (same interface) when it is missing — swap later.
//  Collider formats match world.js collideBuildings: polygon {x,z,r,poly},
//  oriented box {x,z,r,angle,hw,hd}, circle prop {x,z,r,hw=r,prop}, wall segment.
// ============================================================================
import * as THREE from '../../vendor/three.module.min.js';
import { clamp, inPoly, distSeg } from './kit.js';

/** spatial hash over colliders: array with .query(x, z, r, cb) (OnFootController uses it) */
export function colliderIndex(list, cell = 16) {
    const grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
    for (const c of list) {
        if (c.wall && c.x === undefined) { c.x = (c.ax + c.bx) / 2; c.z = (c.az + c.bz) / 2; c.r = Math.hypot(c.bx - c.ax, c.bz - c.az) / 2 + 0.5; } // segments: centre + half length
        if (!c.r) { c.r = c.poly ? 1 : Math.hypot(c.hw || 0.3, c.hd || 0.3); }
        const i0 = Math.floor((c.x - c.r) / cell), i1 = Math.floor((c.x + c.r) / cell), j0 = Math.floor((c.z - c.r) / cell), j1 = Math.floor((c.z + c.r) / cell);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = key(i, j); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(c); }
    }
    const arr = [...list];
    let stamp = 0;
    arr.query = (x, z, r, cb) => {
        stamp++;
        const i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), j0 = Math.floor((z - r) / cell), j1 = Math.floor((z + r) / cell);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const b = grid.get(key(i, j)); if (b) for (const c of b) { if (c._qs === stamp) continue; c._qs = stamp; cb(c); } }
    };
    return arr;
}

function collideOne(b, x, z, radius, y) {
    if (b.y0 !== undefined && y !== undefined && (y > b.y1 || y + 1.7 < b.y0)) return null;
    if (b.prop && b.h !== undefined && y !== undefined && y > (b.y ?? -1e9) + b.h - 0.05 && b.y !== undefined) return null;
    if (b.wall) {
        const r = distSeg(x, z, b.ax, b.az, b.bx, b.bz); if (r.d >= radius) return null;
        // Match the native world's segment-height convention. Upper galleries
        // must not become infinite-height obstacles to ground-floor routing.
        const y0 = b.y0a + (b.y0b - b.y0a) * r.t, y1 = b.y1a + (b.y1b - b.y1a) * r.t;
        if (y !== undefined && (y < y0 - 0.3 || y > y1)) return null;
        return r.d > 1e-4 ? { nx: (x - r.cx) / r.d, nz: (z - r.cz) / r.d, pen: radius - r.d } : { nx: b.nx, nz: b.nz, pen: radius };
    }
    if (b.prop && b.hw === b.r) { const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz); if (d >= b.r + radius) return null; return d > 1e-4 ? { nx: dx / d, nz: dz / d, pen: b.r + radius - d } : { nx: 1, nz: 0, pen: b.r + radius }; }
    if (b.poly) {
        const p = b.poly, holes = b.holes || [], inside = inPoly(x, z, p) && !holes.some(h => inPoly(x, z, h)); let bd = 1e9, nx = 0, nz = 0;
        for (const ring of [p, ...holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const r = distSeg(x, z, ring[j][0], ring[j][1], ring[i][0], ring[i][1]); if (r.d < bd) { bd = r.d; nx = r.d > 1e-5 ? (x - r.cx) / r.d : 0; nz = r.d > 1e-5 ? (z - r.cz) / r.d : 0; } }
        if (inside) return { nx: -nx, nz: -nz, pen: radius + bd };
        return bd < radius ? { nx, nz, pen: radius - bd } : null;
    }
    const dx = x - b.x, dz = z - b.z, c = Math.cos(b.angle || 0), s = Math.sin(b.angle || 0);
    const lx = dx * c - dz * s, lz = dx * s + dz * c, cx = clamp(lx, -b.hw, b.hw), cz = clamp(lz, -b.hd, b.hd), ddx = lx - cx, ddz = lz - cz, d = Math.hypot(ddx, ddz);
    if (d >= radius) return null;
    let nx, nz; if (d > 1e-4) { nx = ddx / d; nz = ddz / d; } else { const ox = b.hw - Math.abs(lx), oz = b.hd - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; } else { nx = 0; nz = Math.sign(lz) || 1; } }
    const pen = d > 1e-4 ? radius - d : radius + Math.min(b.hw - Math.abs(lx), b.hd - Math.abs(lz));
    return { nx: nx * c + nz * s, nz: -nx * s + nz * c, pen };
}
/** push vector out of all colliders near (x, z) */
export function collide(list, x, z, radius, y) {
    let px = 0, pz = 0, hit = null;
    const test = (b) => { const dx = x - b.x, dz = z - b.z; if (dx * dx + dz * dz > (b.r + radius + 0.5) ** 2) return; const r = collideOne(b, x, z, radius, y); if (r && r.pen > 0) { px += r.nx * r.pen; pz += r.nz * r.pen; hit = b; } };
    if (list.query) list.query(x, z, radius + 2, test); else for (const b of list) test(b);
    return hit ? { px, pz, hit } : null;
}

const EYE = 1.65, R = 0.3, WALK = 1.7, RUN = 4.6, JUMP_V = 4.0, G = 9.8, STEP = 0.55;
/** minimal OnFootController stand-in: mouse look, WASD, Shift run, Space jump, collisions, ground/surfaces */
export class LocalWalker {
    constructor({ scene, camera, input, colliders = null, obstacles = null, groundAt = null, audio = null } = {}) {
        Object.assign(this, { scene, camera, input, colliders, obstacles, groundAtFn: groundAt, audio });
        this.rig = new THREE.Object3D(); this.rig.rotation.order = 'YXZ'; this.rig.name = 'spot-walker';
        this.x = 0; this.z = 0; this.y = 0; this.heading = 0; this.pitch = 0; this.vx = 0; this.vz = 0; this.vy = 0; this.jumpY = 0; this.vel = 0; this.t = 0; this.active = false; this.local = true;
    }
    get position() { return { x: this.x, z: this.z, y: this.y + this.jumpY, heading: this.heading }; }
    get fx() { return -Math.sin(this.heading); }
    get fz() { return -Math.cos(this.heading); }
    get speed() { return this.vel; }
    groundAt(x, z, y) { return this.groundAtFn ? this.groundAtFn(x, z, y) : 0; }
    enter(x, z, heading = 0, y = null) { this.x = x; this.z = z; this.heading = heading; this.pitch = 0; this.y = y ?? this.groundAt(x, z, 0); if (!this.rig.parent) this.scene.add(this.rig); this.rig.add(this.camera); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0); this.active = true; this.place(); }
    exit() { this.active = false; this.rig.remove(this.camera); this.rig.removeFromParent(); }
    teleport(x, z, heading = this.heading) { this.x = x; this.z = z; this.heading = heading; this.vx = this.vz = 0; this.y = this.groundAt(x, z, this.y); this.place(); }
    update(dt) {
        if (!this.active) return; dt = Math.min(dt, 0.05); this.t += dt;
        const inp = this.input, lk = inp.takeLook?.() || { dx: 0, dy: 0 };
        this.heading -= lk.dx * 0.0024; this.pitch = clamp(this.pitch - lk.dy * 0.0024, -1.3, 1.3);
        const K = inp.keys || new Set(), mouse = inp.lookHeld || inp.locked;
        let fwd = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0), side = 0, turn = (K.has('ArrowRight') ? 1 : 0) - (K.has('ArrowLeft') ? 1 : 0);
        const a = K.has('KeyA'), d = K.has('KeyD'); if (mouse) side = (d ? 1 : 0) - (a ? 1 : 0); else turn += (d ? 1 : 0) - (a ? 1 : 0);
        if (!K.size && inp.touch?.throttle) fwd = inp.touch.throttle; if (!K.size && inp.touch?.steer) turn = inp.touch.steer;
        if (this.auto) { fwd = this.auto.fwd ?? 0; side = this.auto.side ?? 0; turn = 0; if (this.auto.heading != null) this.heading = this.auto.heading; }
        this.heading -= turn * 1.9 * dt;
        const sp = inp.shift || this.auto?.run ? RUN : WALK, fx = this.fx, fz = this.fz;
        let wx = fx * fwd - fz * side, wz = fz * fwd + fx * side; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
        const k = 1 - Math.exp(-(this.jumpY > 0 ? 2 : 10) * dt); this.vx += (wx * sp - this.vx) * k; this.vz += (wz * sp - this.vz) * k;
        const ox = this.x, oz = this.z; this.x += this.vx * dt; this.z += this.vz * dt;
        const gy = this.groundAt(this.x, this.z, this.y);
        if (gy - this.y > STEP && this.jumpY + this.y < gy - 0.05) { this.x = ox; this.z = oz; }
        else if (this.jumpY <= 0) this.y = gy; else if (gy > this.y) { this.jumpY = Math.max(0, this.jumpY - (gy - this.y)); this.y = gy; }
        const feet = this.y + this.jumpY;
        for (let pass = 0; pass < 2; pass++) {
            let any = false;
            if (this.colliders) { const r = collide(this.colliders, this.x, this.z, R, feet + 0.2); if (r) { this.x += r.px; this.z += r.pz; any = true; } }
            for (const o of this.obstacles?.() || []) {
                const dx = this.x - o.x, dz = this.z - o.z, f = dx * o.fx + dz * o.fz, l = dx * -o.fz + dz * o.fx, hl = o.length / 2 + R, hw = o.width / 2 + R;
                if (Math.abs(f) >= hl || Math.abs(l) >= hw || feet > (o.y ?? 0) + 1.3) continue;
                const pf = hl - Math.abs(f), pl = hw - Math.abs(l);
                if (pl < pf) { const s = l >= 0 ? 1 : -1; this.x += -o.fz * s * pl; this.z += o.fx * s * pl; } else { const s = f >= 0 ? 1 : -1; this.x += o.fx * s * pf; this.z += o.fz * s * pf; }
                any = true;
            }
            if (!any) break;
        }
        this.vel = Math.hypot(this.x - ox, this.z - oz) / Math.max(dt, 1e-4);
        if ((inp.take?.('Space') || this.auto?.jump) && this.jumpY <= 0) { this.vy = JUMP_V; if (this.auto) this.auto.jump = false; }
        if (this.vy !== 0 || this.jumpY > 0) { this.vy -= G * dt; this.jumpY += this.vy * dt; if (this.jumpY <= 0) { this.jumpY = 0; this.vy = 0; } }
        this.place();
    }
    place() {
        const bob = this.jumpY > 0 ? 0 : Math.sin(this.t * 7.5 * (this.vel > 3 ? 1.35 : 1)) * 0.025 * Math.min(1.6, this.vel / 2);
        this.rig.position.set(this.x, this.y + EYE + this.jumpY + bob, this.z); this.rig.rotation.set(this.pitch, this.heading, 0, 'YXZ');
    }
}
