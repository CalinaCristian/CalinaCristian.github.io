// Dinamo's small drone-football secret. Pitch coordinates come from the landmark
// itself, so the moving ball and the scoring planes always match its real goals.
import * as THREE from '../vendor/three.module.min.js';

export const BALL_RADIUS = 0.115; // size 5 football, approximately 70 cm circumference
const DRONE_RADIUS = 0.35, POST_RADIUS = 0.06;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const lerp = (a, b, t) => a + (b - a) * t;
const point = (u = 0, v = 0, h = BALL_RADIUS) => ({ u, v, h });
const length = p => Math.hypot(p.u, p.v, p.h);

/** Small deterministic simulation, also exercised without a renderer by football-check.mjs. */
export class FootballPhysics {
    constructor(pitch, onGoal = () => {}) {
        this.pitch = pitch; this.onGoal = onGoal; this.goals = 0; this.reset();
    }
    reset() {
        this.pos = point(); this.vel = point(0, 0, 0); this.touched = false;
        this.entry = { '-1': false, '1': false }; this.resetIn = 0; this.idle = 0;
    }
    update(dt, drone = null) {
        if (!(dt > 0) || !Number.isFinite(dt)) return;
        dt = Math.min(dt, 0.25);
        const n = Math.ceil(dt * 120), step = dt / n;
        // A teleport, respawn or stale sample cannot kick the ball. Normal boosted
        // Sport tops out below 47 m/s; allow a little integration tolerance.
        const flight = drone && length({ u: drone.to.u - drone.from.u, v: drone.to.v - drone.from.v, h: drone.to.h - drone.from.h }) <= 55 * dt + 0.15 ? drone : null;
        for (let i = 0; i < n; i++) {
            if (this.resetIn) { this.resetIn = Math.max(0, this.resetIn - step); if (!this.resetIn) this.reset(); continue; }
            const before = { ...this.pos };
            if (flight) {
                const a = {}, b = {};
                for (const k of ['u', 'v', 'h']) { a[k] = lerp(flight.from[k], flight.to[k], i / n); b[k] = lerp(flight.from[k], flight.to[k], (i + 1) / n); }
                this.hitDrone(a, b, step);
            }
            const p = this.pos, v = this.vel;
            v.h -= 9.81 * step;
            p.u += v.u * step; p.v += v.v * step; p.h += v.h * step;
            if (p.h < BALL_RADIUS) { p.h = BALL_RADIUS; v.h = Math.abs(v.h) > 0.8 ? -v.h * 0.42 : 0; }
            const speed = Math.hypot(v.u, v.v), slow = Math.exp(-0.16 * step) * Math.max(0, 1 - (p.h <= BALL_RADIUS + 0.01 ? 0.22 : 0) * step / Math.max(speed, 0.01));
            v.u *= slow; v.v *= slow;
            this.posts();
            if (this.checkGoal(before)) continue;
            const outside = Math.abs(p.u) > this.pitch.halfLength + 3 || Math.abs(p.v) > this.pitch.halfWidth + 3;
            this.idle = speed < 0.12 && Math.hypot(p.u, p.v) > 1 ? this.idle + step : 0;
            if (outside || this.idle > 35) this.resetIn = 3;
        }
    }
    hitDrone(a, b, dt) {
        const p = this.pos, dv = { u: (b.u - a.u) / dt, v: (b.v - a.v) / dt, h: (b.h - a.h) / dt };
        const d = { u: b.u - a.u, v: b.v - a.v, h: b.h - a.h }, dd = d.u * d.u + d.v * d.v + d.h * d.h;
        const t = dd > 1e-12 ? clamp(((p.u - a.u) * d.u + (p.v - a.v) * d.v + (p.h - a.h) * d.h) / dd, 0, 1) : 0;
        const q = { u: p.u - lerp(a.u, b.u, t), v: p.v - lerp(a.v, b.v, t), h: p.h - lerp(a.h, b.h, t) }, dist = length(q);
        if (dist > DRONE_RADIUS + BALL_RADIUS || Math.hypot(dv.u, dv.v) < 0.25) return;
        // The rotor guard nudges the ball away horizontally. Keep a gentle lift
        // rather than driving it into the grass when the drone approaches above it.
        let nx = q.u, nz = q.v, l = Math.hypot(nx, nz);
        if (l < 1e-5) { nx = dv.u; nz = dv.v; l = Math.hypot(nx, nz); }
        nx /= l; nz /= l;
        const closing = (dv.u - this.vel.u) * nx + (dv.v - this.vel.v) * nz;
        if (closing < 0.2) return;
        const impulse = Math.min(30, closing * 1.35);
        this.vel.u += nx * impulse; this.vel.v += nz * impulse;
        this.vel.h = Math.max(this.vel.h, Math.min(1.8, impulse * 0.055));
        const speed = Math.hypot(this.vel.u, this.vel.v); if (speed > 30) { this.vel.u *= 30 / speed; this.vel.v *= 30 / speed; }
        this.touched = true; this.idle = 0;
    }
    posts() {
        const p = this.pos, v = this.vel, r = BALL_RADIUS + POST_RADIUS, L = this.pitch.halfLength, W = this.pitch.goalHalfWidth;
        const bounce = (a, b, x, y) => {
            const dx = p[a] - x, dy = p[b] - y, d = Math.hypot(dx, dy); if (d >= r || d < 1e-8) return;
            const nx = dx / d, ny = dy / d, vn = v[a] * nx + v[b] * ny;
            p[a] = x + nx * r; p[b] = y + ny * r;
            if (vn < 0) { v[a] -= 1.65 * vn * nx; v[b] -= 1.65 * vn * ny; }
        };
        for (const s of [-1, 1]) {
            if (p.h < this.pitch.goalHeight + 0.12 + BALL_RADIUS) for (const side of [-1, 1]) bounce('u', 'v', s * L, side * W);
            if (Math.abs(p.v) < W + POST_RADIUS) bounce('u', 'h', s * L, this.pitch.goalHeight + POST_RADIUS);
        }
    }
    checkGoal(before) {
        const p = this.pos, L = this.pitch.halfLength, R = BALL_RADIUS;
        const clear = (a, b, t) => Math.abs(lerp(a.v, b.v, t)) + R < this.pitch.goalHalfWidth - POST_RADIUS && lerp(a.h, b.h, t) + R < this.pitch.goalHeight;
        for (const s of [-1, 1]) {
            const a = before.u * s, b = p.u * s;
            if (!this.touched || b < a - 1e-8) { this.entry[s] = false; continue; }
            if (b <= a) continue; // a ball can stop on the line before another nudge
            if (a <= L - R && b > L - R) this.entry[s] = clear(before, p, (L - R - a) / (b - a));
            if (this.entry[s] && (!clear(before, p, 1) || b < L - R)) this.entry[s] = false;
            if (this.entry[s] && a <= L + R && b > L + R) {
                this.goals++; this.touched = false; this.entry[s] = false; this.resetIn = 3;
                this.vel = point(0, 0, 0); this.onGoal(s); return true;
            }
        }
        return false;
    }
}

function ballMesh() {
    const geometry = new THREE.IcosahedronGeometry(BALL_RADIUS, 2), a = geometry.attributes.position;
    const seedGeometry = new THREE.IcosahedronGeometry(1, 0), seeds = seedGeometry.attributes.position, dirs = [];
    for (let i = 0; i < seeds.count; i++) {
        const d = new THREE.Vector3().fromBufferAttribute(seeds, i).normalize();
        if (!dirs.some(q => q.distanceToSquared(d) < 0.001)) dirs.push(d);
    }
    seedGeometry.dispose();
    const colors = [], white = new THREE.Color('#f7f5ed'), black = new THREE.Color('#1c2026');
    for (let i = 0; i < a.count; i += 3) {
        const d = new THREE.Vector3(); for (let k = 0; k < 3; k++) d.add(new THREE.Vector3().fromBufferAttribute(a, i + k)); d.normalize();
        const c = dirs.some(q => q.dot(d) > 0.93) ? black : white;
        for (let k = 0; k < 3; k++) colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.name = 'dinamo-football'; mesh.receiveShadow = true; mesh.userData.noAudit = true;
    return mesh;
}

function contactMesh() {
    const geometry = new THREE.CircleGeometry(0.2, 20), colors = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(0, 0, 0, i === 0 ? 1 : 0);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, depthWrite: false }));
    mesh.name = 'dinamo-football-contact'; mesh.rotation.x = -Math.PI / 2; mesh.userData.noAudit = true;
    return mesh;
}

export function createDinamoFootball(game) {
    const landmark = game.world?.landmarks?.find(l => l.id === 'dinamo');
    let source = null; landmark?.mesh?.traverse(o => { if (o.userData.footballPitch) source = o; });
    if (!source || !game.world.district) return null; // metres: legacy compressed world is deliberately unchanged
    return new DinamoFootball(game, source);
}

export class DinamoFootball {
    constructor(game, source) {
        this.game = game; this.source = source; this.pitch = source.userData.footballPitch;
        this.mesh = ballMesh(); this.contact = contactMesh(); game.scene.add(this.mesh, this.contact); this.previousDrone = null; this.disposed = false;
        this.physics = new FootballPhysics(this.pitch, () => {
            game.hud?.achievement?.('dinamo-drone-goal');
            game.hud?.toast?.('⚽ Goal!', 'A finish from the drone. Back to the centre spot…', 'intro');
        });
        this.syncMesh();
    }
    local(position) {
        const p = this.source.worldToLocal(new THREE.Vector3(position.x, position.y, position.z)), c = this.pitch.center, [ux, uz] = this.pitch.axis;
        return { u: (p.x - c[0]) * ux + (p.z - c[2]) * uz, v: (p.x - c[0]) * uz - (p.z - c[2]) * ux, h: p.y - c[1] };
    }
    allowsFlightAt(position) {
        if (this.disposed) return false;
        const p = this.local(position);
        return p.h > 0 && Math.abs(p.u) < this.pitch.halfLength + 2 && Math.abs(p.v) < this.pitch.halfWidth + 1;
    }
    update(dt, drone = null) {
        if (this.disposed) return;
        const p = drone?.active && drone.flying && !drone.rth && !this.game.photo?.active ? this.local(drone.pos) : null;
        const flight = p && this.previousDrone ? { from: this.previousDrone, to: p } : null;
        this.previousDrone = p;
        this.physics.update(dt, flight); this.syncMesh();
    }
    syncMesh() {
        const p = this.physics.pos, c = this.pitch.center, [ux, uz] = this.pitch.axis;
        const world = this.source.localToWorld(new THREE.Vector3(c[0] + ux * p.u + uz * p.v, c[1] + p.h, c[2] + uz * p.u - ux * p.v));
        const prev = this.mesh.position.clone(), delta = world.clone().sub(prev);
        this.mesh.position.copy(world);
        // A regulation-size winter ball stays findable against snow without a
        // marker, glow, or oversized silhouette. Clear conditions use white.
        const winter = (this.game.r3d?.weather?.snowDepthCm || 0) > 0 || this.game.wxKind === 'snow';
        if (winter !== this.winter) { this.winter = winter; this.mesh.material.color.set(winter ? '#ff982b' : '#ffffff'); }
        this.contact.position.copy(this.source.localToWorld(new THREE.Vector3(c[0] + ux * p.u + uz * p.v, c[1] + 0.003, c[2] + uz * p.u - ux * p.v)));
        const height = Math.max(0, p.h - BALL_RADIUS);
        this.contact.material.opacity = 0.32 * Math.max(0, 1 - height / 0.8);
        this.contact.scale.setScalar(1 + Math.min(height, 0.8) * 0.3);
        if (prev.lengthSq() && delta.lengthSq() < 4) { const axis = new THREE.Vector3(delta.z, 0, -delta.x).normalize(); this.mesh.rotateOnWorldAxis(axis, Math.hypot(delta.x, delta.z) / BALL_RADIUS); }
    }
    reset() { this.physics.reset(); this.previousDrone = null; this.syncMesh(); }
    dispose() {
        if (this.disposed) return;
        this.disposed = true; this.previousDrone = null; this.physics.reset();
        for (const mesh of [this.mesh, this.contact]) { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose(); }
    }
}
