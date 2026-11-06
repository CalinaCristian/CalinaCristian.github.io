import * as THREE from '../vendor/three.module.min.js';
import { makeCockpit } from './vehicles.js';
import { collideBuildings } from './world.js';
import { clamp, damp, lerp } from './util.js';

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
        this.camHolder.position.set(-0.3, 1.36, -0.45); // driver seat (left-hand drive)
        this.rig.add(this.camHolder);
        this.camHolder.add(camera);
        camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); // camera looks toward -z = car forward
        // rear-view mirror: a small plane in front of the camera showing a render from a rear camera
        this.mirrorTarget = new THREE.WebGLRenderTarget(384, 128);
        this.mirrorTarget.texture.colorSpace = THREE.SRGBColorSpace;
        this.mirrorCam = new THREE.PerspectiveCamera(40, 3, 0.5, 600);
        this.mirrorCam.position.set(0.3, 1.5, 0.3); this.mirrorCam.rotation.set(0, Math.PI, 0);
        this.rig.add(this.mirrorCam);
        const mirrorMat = new THREE.MeshBasicMaterial({ map: this.mirrorTarget.texture, toneMapped: false });
        mirrorMat.map.repeat.x = -1; mirrorMat.map.offset.x = 1; // mirror flip
        this.mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.11), mirrorMat);
        this.mirror.position.set(0.34, 0.32, -1.05);
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.02), new THREE.MeshBasicMaterial({ color: '#15171a' }));
        frame.position.z = -0.011; this.mirror.add(frame);
        this.camHolder.add(this.mirror);
        this.mirrorEnabled = true;
        scene.add(this.rig);
        this.length = 4.4; this.width = 1.8; this.radius = 1.1;
        this.bob = 0; this.shake = 0; this.collisionCd = 0;
        this.maxSpeed = 36; // m/s (~130 km/h)
        this.lookBack = false;
        this.bounds = null; this.world = null; this.traffic = null;
        this.onCollide = () => { };
    }
    place(x, z, heading) { this.x = x; this.z = z; this.heading = heading; this.speed = 0; this.updateRig(0); }
    get fx() { return -Math.sin(this.heading); }
    get fz() { return -Math.cos(this.heading); }

    update(dt, input, opts = {}) {
        dt = Math.min(dt, 0.05);
        const throttle = input.throttle, brake = input.brake;
        const steerIn = input.steer;
        // steering: less lock at speed
        const lock = lerp(0.65, 0.22, clamp(Math.abs(this.speed) / 30, 0, 1));
        this.steer = damp(this.steer, steerIn * lock, 8, dt);
        this.steerVisual = damp(this.steerVisual, steerIn, 6, dt);
        // longitudinal
        const maxSpeed = opts.maxSpeed || this.maxSpeed;
        let acc = 0;
        if (throttle > 0) acc = 7.5 * (1 - this.speed / maxSpeed);
        else if (throttle < 0) acc = this.speed > 0.5 ? -9 : -3.5; // brake, then reverse
        if (brake) acc -= 10 * Math.sign(this.speed || 1);
        // drag + rolling
        acc -= this.speed * 0.12 + Math.sign(this.speed) * 0.6;
        this.speed += acc * dt;
        if (throttle === 0 && !brake && Math.abs(this.speed) < 0.4) this.speed = 0;
        this.speed = clamp(this.speed, -8, maxSpeed);
        // yaw
        const turnRate = this.steer * (this.speed / 2.8) / 1.0; // bicycle-ish
        this.heading -= turnRate * dt * Math.sign(this.speed >= 0 ? 1 : -1) * (Math.abs(this.speed) > 0.3 ? 1 : 0);
        // move
        const nx = this.x + this.fx * this.speed * dt, nz = this.z + this.fz * this.speed * dt;
        this.x = nx; this.z = nz;
        this.collide(dt);
        this.collidePeds();
        // bounds (soft wall)
        if (this.bounds) {
            const b = this.bounds, m = 40;
            if (this.x < b.minX + m || this.x > b.maxX - m || this.z < b.minZ + m || this.z > b.maxZ - m) {
                this.x = clamp(this.x, b.minX + m, b.maxX - m); this.z = clamp(this.z, b.minZ + m, b.maxZ - m); this.speed *= 0.5;
            }
        }
        this.collisionCd = Math.max(0, this.collisionCd - dt);
        this.shake = Math.max(0, this.shake - dt * 2);
        this.bob += dt * (2 + Math.abs(this.speed) * 0.3);
        this.updateRig(dt);
    }

    collide(dt) {
        // buildings (two circles: front & rear)
        if (this.world) {
            for (const o of [1.3, -1.3]) {
                const px = this.x + this.fx * o, pz = this.z + this.fz * o;
                const r = collideBuildings(this.world.buildings, px, pz, 1.0);
                if (r) {
                    this.x += r.px; this.z += r.pz;
                    this.hit(Math.abs(this.speed), 'building');
                    this.speed *= -0.25;
                }
            }
        }
        // vehicles
        if (this.traffic) {
            const near = this.traffic.near(this.x, this.z, 16);
            for (const v of near) {
                // treat each vehicle as a few circles along its length
                const n = Math.max(1, Math.round(v.length / 2.2));
                for (let i = 0; i < n; i++) {
                    const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (v.length - 2.0);
                    const vx = v.x - v.fx * t * -1, vz = v.z - v.fz * t * -1; // v.fx is travel dir; mesh front = +f
                    for (const o of [1.3, -1.3]) {
                        const px = this.x + this.fx * o, pz = this.z + this.fz * o;
                        const dx = px - vx, dz = pz - vz;
                        const d = Math.hypot(dx, dz), minD = 1.0 + v.width / 2 + 0.1;
                        if (d < minD && d > 1e-4) {
                            const pen = minD - d;
                            this.x += dx / d * pen; this.z += dz / d * pen;
                            const rel = Math.abs(this.speed - v.speed);
                            if (this.collisionCd <= 0 && rel > 1.5) { this.hit(rel, 'vehicle', v); }
                            this.speed *= 0.4;
                        }
                    }
                }
            }
        }
    }
    /** pedestrians: knocked over when hit at speed, nudged aside when slow */
    collidePeds() {
        if (!this.traffic || !this.traffic.nearPeds) return;
        this.pedCd = Math.max(0, (this.pedCd || 0) - 1 / 60);
        for (const p of this.traffic.nearPeds(this.x, this.z, 4)) {
            if (p.state === 'down') continue;
            for (const o of [1.4, 0, -1.4]) {
                const cx = this.x + this.fx * o, cz = this.z + this.fz * o;
                const dx = p.x - cx, dz = p.z - cz; const d = Math.hypot(dx, dz);
                if (d > 1.25 || d < 1e-4) continue;
                const sp = Math.abs(this.speed);
                if (sp > 2.2) {
                    const nx = dx / d * 0.5 + this.fx * Math.sign(this.speed) * 0.5, nz = dz / d * 0.5 + this.fz * Math.sign(this.speed) * 0.5;
                    if (this.traffic.peds.knock(p, nx, nz, sp)) {
                        this.shake = clamp(sp / 15, 0.2, 0.8);
                        this.onCollide(sp, 'pedestrian', p);
                        this.speed *= 0.7;
                    }
                } else { p.x = cx + dx / d * 1.25; p.z = cz + dz / d * 1.25; }
                break;
            }
        }
    }
    /** render the rear view into the mirror texture (call before the main render) */
    renderMirror(renderer, scene) {
        if (!this.mirrorEnabled || this.lookBack) return;
        this.mirror.visible = false;
        const prev = renderer.getRenderTarget();
        renderer.setRenderTarget(this.mirrorTarget);
        renderer.render(scene, this.mirrorCam);
        renderer.setRenderTarget(prev);
        this.mirror.visible = true;
    }
    hit(strength, what, v) {
        if (this.collisionCd > 0) return;
        this.collisionCd = 0.5;
        this.shake = clamp(strength / 12, 0.15, 1);
        this.onCollide(strength, what, v);
    }

    updateRig(dt) {
        this.rig.position.set(this.x, 0.24, this.z);
        this.rig.rotation.y = this.heading;
        // body roll / pitch
        const roll = -this.steerVisual * clamp(Math.abs(this.speed) / 25, 0, 1) * 0.035;
        this.rig.rotation.z = roll;
        this.cockpit.userData.wheel.rotation.z = this.steerVisual * 1.6 - 0; // wheel turn
        // camera bob + shake + look-back
        const s = this.shake;
        const bobY = Math.sin(this.bob) * 0.004 * clamp(Math.abs(this.speed) / 10, 0, 1);
        this.camHolder.position.y = 1.36 + bobY + (Math.random() - 0.5) * s * 0.08;
        if (this.mirror) this.mirror.visible = this.mirrorEnabled && !this.lookBack;
        this.camHolder.rotation.x = (Math.random() - 0.5) * s * 0.04 + this.speed * 0.0004;
        this.camHolder.rotation.y = damp(this.camHolder.rotation.y, (this.lookBack ? Math.PI : 0) + this.steerVisual * 0.06, 10, dt || 0.016);
        this.camHolder.rotation.z = (Math.random() - 0.5) * s * 0.03;
        this.camera.fov = damp(this.camera.fov, 72 + clamp(this.speed, 0, 40) * 0.35, 4, dt || 0.016);
        this.camera.updateProjectionMatrix();
    }
}
